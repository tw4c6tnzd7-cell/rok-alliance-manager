import os
import sqlite3
import logging
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv
from deep_translator import GoogleTranslator


# =========================================================
# CONFIGURACIÓN
# =========================================================

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")

if not TOKEN:
    raise RuntimeError(
        "No se ha encontrado DISCORD_TOKEN. "
        "Añádelo como variable de entorno y NO lo escribas directamente en el código."
    )


# =========================================================
# LOGS
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger("rok-alliance-manager")


# =========================================================
# BASE DE DATOS
# =========================================================

DB_FILE = "rok_bot.db"


def db_connection():
    return sqlite3.connect(DB_FILE)


def init_database():
    conn = db_connection()
    cursor = conn.cursor()

    # Configuración por servidor
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS guild_config (
            guild_id INTEGER PRIMARY KEY,
            alliance_name TEXT,
            kingdom TEXT,
            community_name TEXT,
            default_language TEXT DEFAULT 'es',
            welcome_channel_id INTEGER,
            rules_channel_id INTEGER,
            alliance_role_id INTEGER,
            community_description TEXT,
            alliance_description TEXT,
            invite_link TEXT
        )
        """
    )

    # Preferencia de idioma de cada usuario
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_language (
            guild_id INTEGER,
            user_id INTEGER,
            language TEXT DEFAULT 'es',
            PRIMARY KEY (guild_id, user_id)
        )
        """
    )

    # Traducciones asociadas a mensajes bilingües
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS bilingual_messages (
            message_id INTEGER PRIMARY KEY,
            guild_id INTEGER,
            spanish_text TEXT,
            english_text TEXT
        )
        """
    )

    conn.commit()
    conn.close()


def ensure_guild_config(guild_id: int):
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT OR IGNORE INTO guild_config (guild_id)
        VALUES (?)
        """,
        (guild_id,)
    )

    conn.commit()
    conn.close()


def get_guild_config(guild_id: int):
    ensure_guild_config(guild_id)

    conn = db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM guild_config
        WHERE guild_id = ?
        """,
        (guild_id,)
    )

    result = cursor.fetchone()
    conn.close()

    return result


def update_guild_config(guild_id: int, **kwargs):
    ensure_guild_config(guild_id)

    valid_fields = {
        "alliance_name",
        "kingdom",
        "community_name",
        "default_language",
        "welcome_channel_id",
        "rules_channel_id",
        "alliance_role_id",
        "community_description",
        "alliance_description",
        "invite_link",
    }

    conn = db_connection()
    cursor = conn.cursor()

    for field, value in kwargs.items():
        if field not in valid_fields:
            continue

        cursor.execute(
            f"""
            UPDATE guild_config
            SET {field} = ?
            WHERE guild_id = ?
            """,
            (value, guild_id)
        )

    conn.commit()
    conn.close()


def set_user_language(guild_id: int, user_id: int, language: str):
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO user_language (guild_id, user_id, language)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, user_id)
        DO UPDATE SET language = excluded.language
        """,
        (guild_id, user_id, language)
    )

    conn.commit()
    conn.close()


def get_user_language(guild_id: int, user_id: int):
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT language
        FROM user_language
        WHERE guild_id = ? AND user_id = ?
        """,
        (guild_id, user_id)
    )

    result = cursor.fetchone()
    conn.close()

    if result:
        return result[0]

    config = get_guild_config(guild_id)
    return config["default_language"] or "es"


def save_bilingual_message(
    message_id: int,
    guild_id: int,
    spanish_text: str,
    english_text: str
):
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT OR REPLACE INTO bilingual_messages (
            message_id,
            guild_id,
            spanish_text,
            english_text
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            message_id,
            guild_id,
            spanish_text,
            english_text
        )
    )

    conn.commit()
    conn.close()


def get_bilingual_message(message_id: int):
    conn = db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM bilingual_messages
        WHERE message_id = ?
        """,
        (message_id,)
    )

    result = cursor.fetchone()
    conn.close()

    return result


# =========================================================
# TRADUCCIÓN
# =========================================================

def translate_text(text: str, target: str) -> str:
    """
    target:
        es -> español
        en -> inglés
    """

    try:
        translated = GoogleTranslator(
            source="auto",
            target=target
        ).translate(text)

        return translated

    except Exception as error:
        logger.exception("Error traduciendo texto: %s", error)

        if target == "es":
            return "⚠️ No se pudo realizar la traducción al español."

        return "⚠️ Translation could not be completed."


# =========================================================
# INTENTS
# =========================================================

intents = discord.Intents.default()

# Necesario para detectar nuevos miembros
intents.members = True


# =========================================================
# BOT
# =========================================================

class ROKBot(commands.Bot):

    def __init__(self):
        super().__init__(
            command_prefix="!",
            intents=intents
        )

    async def setup_hook(self):
        # Vista persistente de idiomas.
        self.add_view(LanguageButtons())

        try:
            synced = await self.tree.sync()
            logger.info(
                "Comandos sincronizados: %s",
                len(synced)
            )

        except Exception as error:
            logger.exception(
                "Error sincronizando comandos: %s",
                error
            )


bot = ROKBot()


# =========================================================
# BOTONES PERSISTENTES ESPAÑOL / INGLÉS
# =========================================================

class LanguageButtons(discord.ui.View):

    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Español",
        emoji="🇪🇸",
        style=discord.ButtonStyle.primary,
        custom_id="rok_language_spanish"
    )
    async def spanish_button(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button
    ):
        if interaction.guild is None:
            await interaction.response.send_message(
                "Este botón solamente funciona dentro del servidor.",
                ephemeral=True
            )
            return

        # Guardamos la preferencia del usuario.
        set_user_language(
            interaction.guild.id,
            interaction.user.id,
            "es"
        )

        stored_message = None

        if interaction.message:
            stored_message = get_bilingual_message(
                interaction.message.id
            )

        if stored_message:
            await interaction.response.send_message(
                f"🇪🇸 **Español**\n\n"
                f"{stored_message['spanish_text']}",
                ephemeral=True
            )
            return

        await interaction.response.send_message(
            "🇪🇸 Idioma configurado en **Español**.",
            ephemeral=True
        )

    @discord.ui.button(
        label="English",
        emoji="🇬🇧",
        style=discord.ButtonStyle.primary,
        custom_id="rok_language_english"
    )
    async def english_button(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button
    ):
        if interaction.guild is None:
            await interaction.response.send_message(
                "This button only works inside the server.",
                ephemeral=True
            )
            return

        set_user_language(
            interaction.guild.id,
            interaction.user.id,
            "en"
        )

        stored_message = None

        if interaction.message:
            stored_message = get_bilingual_message(
                interaction.message.id
            )

        if stored_message:
            await interaction.response.send_message(
                f"🇬🇧 **English**\n\n"
                f"{stored_message['english_text']}",
                ephemeral=True
            )
            return

        await interaction.response.send_message(
            "🇬🇧 Language set to **English**.",
            ephemeral=True
        )


# =========================================================
# EVENTOS
# =========================================================

@bot.event
async def on_ready():

    logger.info(
        "Bot conectado como %s (%s)",
        bot.user,
        bot.user.id if bot.user else "?"
    )

    logger.info(
        "Conectado a %s servidor(es).",
        len(bot.guilds)
    )

    for guild in bot.guilds:
        ensure_guild_config(guild.id)


@bot.event
async def on_guild_join(guild: discord.Guild):
    ensure_guild_config(guild.id)

    logger.info(
        "Bot añadido al servidor: %s (%s)",
        guild.name,
        guild.id
    )


@bot.event
async def on_member_join(member: discord.Member):

    if member.bot:
        return

    config = get_guild_config(member.guild.id)

    # -----------------------------------------------------
    # ROL AUTOMÁTICO DE ALIANZA
    # -----------------------------------------------------

    role_id = config["alliance_role_id"]

    if role_id:
        role = member.guild.get_role(role_id)

        if role:
            try:
                await member.add_roles(
                    role,
                    reason="ROK Alliance Manager - nuevo miembro"
                )

            except discord.Forbidden:
                logger.warning(
                    "No puedo asignar el rol %s en %s.",
                    role.name,
                    member.guild.name
                )

            except Exception:
                logger.exception(
                    "Error asignando rol automático."
                )

    # -----------------------------------------------------
    # MENSAJE DE BIENVENIDA
    # -----------------------------------------------------

    channel_id = config["welcome_channel_id"]

    if not channel_id:
        return

    channel = member.guild.get_channel(channel_id)

    if not channel:
        return

    alliance = config["alliance_name"] or "nuestra alianza"
    community = config["community_name"] or member.guild.name
    kingdom = config["kingdom"] or "—"

    spanish = (
        f"👋 ¡Bienvenido/a {member.mention} a **{community}**!\n\n"
        f"⚔️ **Alianza:** {alliance}\n"
        f"👑 **Reino:** {kingdom}\n\n"
        f"Selecciona tu idioma usando los botones de abajo.\n"
        f"Esperamos que disfrutes de la comunidad. ❤️"
    )

    english = (
        f"👋 Welcome {member.mention} to **{community}**!\n\n"
        f"⚔️ **Alliance:** {alliance}\n"
        f"👑 **Kingdom:** {kingdom}\n\n"
        f"Choose your language using the buttons below.\n"
        f"We hope you enjoy the community. ❤️"
    )

    try:
        message = await channel.send(
            spanish,
            view=LanguageButtons()
        )

        save_bilingual_message(
            message.id,
            member.guild.id,
            spanish,
            english
        )

    except Exception:
        logger.exception(
            "No se pudo enviar la bienvenida."
        )


# =========================================================
# COMPROBACIONES
# =========================================================

def is_admin(interaction: discord.Interaction) -> bool:

    if interaction.guild is None:
        return False

    permissions = interaction.user.guild_permissions

    return (
        permissions.administrator
        or permissions.manage_guild
    )


async def require_admin(interaction: discord.Interaction):

    if is_admin(interaction):
        return True

    await interaction.response.send_message(
        "❌ Necesitas el permiso **Gestionar servidor** "
        "o **Administrador** para utilizar este comando.",
        ephemeral=True
    )

    return False


# =========================================================
# /AYUDA
# =========================================================

@bot.tree.command(
    name="ayuda",
    description="Muestra los comandos disponibles del bot."
)
async def ayuda(interaction: discord.Interaction):

    if interaction.guild is None:
        await interaction.response.send_message(
            "Este comando solamente funciona dentro de un servidor.",
            ephemeral=True
        )
        return

    language = get_user_language(
        interaction.guild.id,
        interaction.user.id
    )

    if language == "en":

        embed = discord.Embed(
            title="⚔️ ROK Alliance Manager",
            description=(
                "Community and alliance management bot "
                "for Rise of Kingdoms."
            )
        )

        embed.add_field(
            name="🌍 Language",
            value="`/idioma`",
            inline=False
        )

        embed.add_field(
            name="⚔️ Alliance information",
            value="`/alianza`",
            inline=False
        )

        embed.add_field(
            name="👥 Community information",
            value="`/comunidad`",
            inline=False
        )

        embed.add_field(
            name="🌐 Translate",
            value="`/traducir`",
            inline=False
        )

        embed.add_field(
            name="📢 Bilingual publication",
            value="`/publicar` — Administrators",
            inline=False
        )

        embed.add_field(
            name="⚙️ Server configuration",
            value="`/configurar` — Administrators",
            inline=False
        )

    else:

        embed = discord.Embed(
            title="⚔️ ROK Alliance Manager",
            description=(
                "Bot para gestionar la comunidad y la alianza "
                "de Rise of Kingdoms."
            )
        )

        embed.add_field(
            name="🌍 Idioma",
            value="`/idioma`",
            inline=False
        )

        embed.add_field(
            name="⚔️ Información de alianza",
            value="`/alianza`",
            inline=False
        )

        embed.add_field(
            name="👥 Información de comunidad",
            value="`/comunidad`",
            inline=False
        )

        embed.add_field(
            name="🌐 Traductor",
            value="`/traducir`",
            inline=False
        )

        embed.add_field(
            name="📢 Publicación bilingüe",
            value="`/publicar` — Administradores",
            inline=False
        )

        embed.add_field(
            name="⚙️ Configuración",
            value="`/configurar` — Administradores",
            inline=False
        )

    await interaction.response.send_message(
        embed=embed,
        ephemeral=True
    )


# =========================================================
# /IDIOMA
# =========================================================

@bot.tree.command(
    name="idioma",
    description="Selecciona español o inglés / Select Spanish or English."
)
async def idioma(interaction: discord.Interaction):

    if interaction.guild is None:
        await interaction.response.send_message(
            "Este comando solamente funciona dentro de un servidor.",
            ephemeral=True
        )
        return

    await interaction.response.send_message(
        "🌍 **Selecciona tu idioma / Select your language**",
        view=LanguageButtons(),
        ephemeral=True
    )


# =========================================================
# /TRADUCIR
# =========================================================

language_choices = [
    app_commands.Choice(
        name="🇪🇸 Español",
        value="es"
    ),
    app_commands.Choice(
        name="🇬🇧 English",
        value="en"
    )
]


@bot.tree.command(
    name="traducir",
    description="Traduce un texto al español o al inglés."
)
@app_commands.describe(
    texto="Texto que quieres traducir.",
    idioma="Idioma al que quieres traducir."
)
@app_commands.choices(
    idioma=language_choices
)
async def traducir(
    interaction: discord.Interaction,
    texto: str,
    idioma: app_commands.Choice[str]
):

    await interaction.response.defer(
        ephemeral=True
    )

    if len(texto) > 4000:
        await interaction.followup.send(
            "❌ El texto es demasiado largo. "
            "Máximo: 4000 caracteres.",
            ephemeral=True
        )
        return

    translation = translate_text(
        texto,
        idioma.value
    )

    if idioma.value == "es":
        title = "🇪🇸 Traducción al español"
    else:
        title = "🇬🇧 English translation"

    embed = discord.Embed(
        title=title,
        description=translation
    )

    await interaction.followup.send(
        embed=embed,
        ephemeral=True
    )


# =========================================================
# /PUBLICAR
# =========================================================

@bot.tree.command(
    name="publicar",
    description="Publica un mensaje con botones Español / English."
)
@app_commands.describe(
    texto="Mensaje que quieres publicar.",
    canal="Canal donde quieres publicar el mensaje."
)
async def publicar(
    interaction: discord.Interaction,
    texto: str,
    canal: Optional[discord.TextChannel] = None
):

    if interaction.guild is None:
        return

    if not await require_admin(interaction):
        return

    await interaction.response.defer(
        ephemeral=True
    )

    target_channel = canal or interaction.channel

    if not isinstance(target_channel, discord.TextChannel):
        await interaction.followup.send(
            "❌ Debes seleccionar un canal de texto.",
            ephemeral=True
        )
        return

    if len(texto) > 3500:
        await interaction.followup.send(
            "❌ El mensaje es demasiado largo.",
            ephemeral=True
        )
        return

    spanish = translate_text(
        texto,
        "es"
    )

    english = translate_text(
        texto,
        "en"
    )

    embed = discord.Embed(
        title="🌍 Mensaje de la comunidad / Community Message",
        description=(
            "Selecciona tu idioma para leer el mensaje.\n\n"
            "Choose your language to read the message."
        )
    )

    embed.set_footer(
        text="ROK Alliance Manager"
    )

    try:

        message = await target_channel.send(
            embed=embed,
            view=LanguageButtons()
        )

        save_bilingual_message(
            message.id,
            interaction.guild.id,
            spanish,
            english
        )

        await interaction.followup.send(
            f"✅ Publicación enviada correctamente en "
            f"{target_channel.mention}.",
            ephemeral=True
        )

    except discord.Forbidden:

        await interaction.followup.send(
            "❌ No tengo permiso para escribir en ese canal.",
            ephemeral=True
        )


# =========================================================
# /ALIANZA
# =========================================================

@bot.tree.command(
    name="alianza",
    description="Muestra información de la alianza."
)
async def alianza(interaction: discord.Interaction):

    if interaction.guild is None:
        return

    config = get_guild_config(
        interaction.guild.id
    )

    language = get_user_language(
        interaction.guild.id,
        interaction.user.id
    )

    alliance_name = (
        config["alliance_name"]
        or "Sin configurar"
    )

    kingdom = (
        config["kingdom"]
        or "Sin configurar"
    )

    description = (
        config["alliance_description"]
        or "Sin descripción."
    )

    if language == "en":

        description = translate_text(
            description,
            "en"
        )

        embed = discord.Embed(
            title=f"⚔️ {alliance_name}",
            description=description
        )

        embed.add_field(
            name="👑 Kingdom",
            value=kingdom
        )

        embed.add_field(
            name="👥 Members",
            value=str(interaction.guild.member_count)
        )

    else:

        embed = discord.Embed(
            title=f"⚔️ {alliance_name}",
            description=description
        )

        embed.add_field(
            name="👑 Reino",
            value=kingdom
        )

        embed.add_field(
            name="👥 Miembros",
            value=str(interaction.guild.member_count)
        )

    await interaction.response.send_message(
        embed=embed
    )


# =========================================================
# /COMUNIDAD
# =========================================================

@bot.tree.command(
    name="comunidad",
    description="Muestra información sobre la comunidad."
)
async def comunidad(interaction: discord.Interaction):

    if interaction.guild is None:
        return

    config = get_guild_config(
        interaction.guild.id
    )

    language = get_user_language(
        interaction.guild.id,
        interaction.user.id
    )

    community_name = (
        config["community_name"]
        or interaction.guild.name
    )

    description = (
        config["community_description"]
        or "Comunidad de Rise of Kingdoms."
    )

    if language == "en":
        description = translate_text(
            description,
            "en"
        )

    embed = discord.Embed(
        title=f"👥 {community_name}",
        description=description
    )

    if config["rules_channel_id"]:
        rules_channel = interaction.guild.get_channel(
            config["rules_channel_id"]
        )

        if rules_channel:

            if language == "en":
                embed.add_field(
                    name="📜 Rules",
                    value=rules_channel.mention,
                    inline=False
                )
            else:
                embed.add_field(
                    name="📜 Normas",
                    value=rules_channel.mention,
                    inline=False
                )

    if config["invite_link"]:

        if language == "en":
            embed.add_field(
                name="🔗 Invitation",
                value=config["invite_link"],
                inline=False
            )
        else:
            embed.add_field(
                name="🔗 Invitación",
                value=config["invite_link"],
                inline=False
            )

    await interaction.response.send_message(
        embed=embed
    )


# =========================================================
# GRUPO /CONFIGURAR
# =========================================================

class ConfigCommands(
    app_commands.Group,
    name="configurar",
    description="Configuración administrativa del bot."
):

    @app_commands.command(
        name="alianza",
        description="Configura la alianza y el reino."
    )
    @app_commands.describe(
        nombre="Nombre de la alianza.",
        reino="Número o nombre del reino.",
        descripcion="Descripción de la alianza."
    )
    async def configurar_alianza(
        self,
        interaction: discord.Interaction,
        nombre: str,
        reino: str,
        descripcion: Optional[str] = None
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        update_guild_config(
            interaction.guild.id,
            alliance_name=nombre,
            kingdom=reino,
            alliance_description=descripcion or ""
        )

        await interaction.response.send_message(
            f"✅ **Alianza configurada**\n\n"
            f"⚔️ Alianza: **{nombre}**\n"
            f"👑 Reino: **{reino}**",
            ephemeral=True
        )

    @app_commands.command(
        name="comunidad",
        description="Configura el nombre y descripción de la comunidad."
    )
    @app_commands.describe(
        nombre="Nombre de la comunidad.",
        descripcion="Descripción de la comunidad.",
        invitacion="Enlace de invitación permanente."
    )
    async def configurar_comunidad(
        self,
        interaction: discord.Interaction,
        nombre: str,
        descripcion: Optional[str] = None,
        invitacion: Optional[str] = None
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        update_guild_config(
            interaction.guild.id,
            community_name=nombre,
            community_description=descripcion or "",
            invite_link=invitacion or ""
        )

        await interaction.response.send_message(
            "✅ Configuración de comunidad guardada.",
            ephemeral=True
        )

    @app_commands.command(
        name="bienvenida",
        description="Selecciona el canal de bienvenida."
    )
    @app_commands.describe(
        canal="Canal donde el bot dará la bienvenida."
    )
    async def configurar_bienvenida(
        self,
        interaction: discord.Interaction,
        canal: discord.TextChannel
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        update_guild_config(
            interaction.guild.id,
            welcome_channel_id=canal.id
        )

        await interaction.response.send_message(
            f"✅ Canal de bienvenida configurado: "
            f"{canal.mention}",
            ephemeral=True
        )

    @app_commands.command(
        name="normas",
        description="Selecciona el canal de normas."
    )
    @app_commands.describe(
        canal="Canal que contiene las normas."
    )
    async def configurar_normas(
        self,
        interaction: discord.Interaction,
        canal: discord.TextChannel
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        update_guild_config(
            interaction.guild.id,
            rules_channel_id=canal.id
        )

        await interaction.response.send_message(
            f"✅ Canal de normas configurado: "
            f"{canal.mention}",
            ephemeral=True
        )

    @app_commands.command(
        name="rol",
        description="Configura el rol automático de miembros."
    )
    @app_commands.describe(
        rol="Rol que recibirán los nuevos miembros."
    )
    async def configurar_rol(
        self,
        interaction: discord.Interaction,
        rol: discord.Role
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        bot_member = interaction.guild.me

        if bot_member and rol >= bot_member.top_role:

            await interaction.response.send_message(
                "❌ Ese rol está por encima o al mismo nivel que "
                "el rol del bot.\n\n"
                "Mueve el rol del bot por encima de ese rol "
                "en **Ajustes → Roles**.",
                ephemeral=True
            )
            return

        update_guild_config(
            interaction.guild.id,
            alliance_role_id=rol.id
        )

        await interaction.response.send_message(
            f"✅ Rol automático configurado: "
            f"{rol.mention}",
            ephemeral=True
        )

    @app_commands.command(
        name="idioma",
        description="Configura el idioma predeterminado del servidor."
    )
    @app_commands.choices(
        idioma=language_choices
    )
    async def configurar_idioma(
        self,
        interaction: discord.Interaction,
        idioma: app_commands.Choice[str]
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        update_guild_config(
            interaction.guild.id,
            default_language=idioma.value
        )

        await interaction.response.send_message(
            f"✅ Idioma predeterminado: "
            f"**{idioma.name}**",
            ephemeral=True
        )

    @app_commands.command(
        name="ver",
        description="Muestra la configuración actual."
    )
    async def ver_configuracion(
        self,
        interaction: discord.Interaction
    ):

        if interaction.guild is None:
            return

        if not await require_admin(interaction):
            return

        config = get_guild_config(
            interaction.guild.id
        )

        welcome = "No configurado"

        if config["welcome_channel_id"]:
            channel = interaction.guild.get_channel(
                config["welcome_channel_id"]
            )

            if channel:
                welcome = channel.mention

        rules = "No configurado"

        if config["rules_channel_id"]:
            channel = interaction.guild.get_channel(
                config["rules_channel_id"]
            )

            if channel:
                rules = channel.mention

        role = "No configurado"

        if config["alliance_role_id"]:
            guild_role = interaction.guild.get_role(
                config["alliance_role_id"]
            )

            if guild_role:
                role = guild_role.mention

        embed = discord.Embed(
            title="⚙️ Configuración de ROK Alliance Manager"
        )

        embed.add_field(
            name="⚔️ Alianza",
            value=config["alliance_name"] or "No configurada",
            inline=False
        )

        embed.add_field(
            name="👑 Reino",
            value=config["kingdom"] or "No configurado",
            inline=False
        )

        embed.add_field(
            name="👥 Comunidad",
            value=config["community_name"] or "No configurada",
            inline=False
        )

        embed.add_field(
            name="👋 Bienvenida",
            value=welcome,
            inline=False
        )

        embed.add_field(
            name="📜 Normas",
            value=rules,
            inline=False
        )

        embed.add_field(
            name="🎭 Rol automático",
            value=role,
            inline=False
        )

        embed.add_field(
            name="🌍 Idioma predeterminado",
            value=(
                "Español"
                if config["default_language"] == "es"
                else "English"
            ),
            inline=False
        )

        await interaction.response.send_message(
            embed=embed,
            ephemeral=True
        )


bot.tree.add_command(
    ConfigCommands()
)


# =========================================================
# ERRORES DE COMANDOS
# =========================================================

@bot.tree.error
async def on_app_command_error(
    interaction: discord.Interaction,
    error: app_commands.AppCommandError
):

    logger.exception(
        "Error ejecutando slash command",
        exc_info=error
    )

    message = (
        "⚠️ Se ha producido un error ejecutando el comando.\n"
        "Comprueba los permisos del bot e inténtalo de nuevo."
    )

    try:

        if interaction.response.is_done():

            await interaction.followup.send(
                message,
                ephemeral=True
            )

        else:

            await interaction.response.send_message(
                message,
                ephemeral=True
            )

    except Exception:
        logger.exception(
            "No se pudo enviar el mensaje de error."
        )


# =========================================================
# EJECUCIÓN
# =========================================================

if __name__ == "__main__":

    init_database()

    logger.info(
        "Iniciando ROK Alliance Manager..."
    )

    bot.run(TOKEN)