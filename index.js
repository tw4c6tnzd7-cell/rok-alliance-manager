const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  Events,
  MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const translate = require("translate-google");

require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ ERROR: No existe la variable DISCORD_TOKEN.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = path.join(__dirname, "data.json");

let database = {
  guilds: {},
  users: {},
  messages: {},
  requests: {}
};

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      if (data.trim()) {
        database = JSON.parse(data);
      }
    }
  } catch (error) {
    console.error("❌ Error cargando data.json:", error);
  }

  if (!database.guilds) database.guilds = {};
  if (!database.users) database.users = {};
  if (!database.messages) database.messages = {};
  if (!database.requests) database.requests = {};
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Error guardando data.json:", error);
  }
}

function getGuildConfig(guildId) {
  if (!database.guilds[guildId]) {
    database.guilds[guildId] = {};
  }

  const config = database.guilds[guildId];

  if (config.allianceName === undefined) config.allianceName = "";
  if (config.kingdom === undefined) config.kingdom = "";
  if (config.communityName === undefined) config.communityName = "";
  if (config.allianceDescription === undefined) config.allianceDescription = "";
  if (config.communityDescription === undefined) config.communityDescription = "";
  if (config.welcomeChannelId === undefined) config.welcomeChannelId = "";
  if (config.rulesChannelId === undefined) config.rulesChannelId = "";
  if (config.allianceChannelId === undefined) config.allianceChannelId = "";
  if (config.communityChannelId === undefined) config.communityChannelId = "";
  if (config.requestChannelId === undefined) config.requestChannelId = "";
  if (config.memberRoleId === undefined) config.memberRoleId = "";
  if (config.defaultLanguage === undefined) config.defaultLanguage = "es";
  if (config.inviteLink === undefined) config.inviteLink = "";

  saveDatabase();
  return config;
}

function getUserLanguage(guildId, userId) {
  const key = `${guildId}_${userId}`;
  if (database.users[key]) return database.users[key];
  return getGuildConfig(guildId).defaultLanguage || "es";
}

function setUserLanguage(guildId, userId, language) {
  database.users[`${guildId}_${userId}`] = language;
  saveDatabase();
}

async function translateText(text, targetLanguage) {
  try {
    return await translate(text, { to: targetLanguage });
  } catch (error) {
    console.error("❌ Error traduciendo:", error);
    return targetLanguage === "es"
      ? "⚠️ No se pudo realizar la traducción."
      : "⚠️ Translation could not be completed.";
  }
}

function languageButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("language_es")
      .setLabel("Español")
      .setEmoji("🇪🇸")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("language_en")
      .setLabel("English")
      .setEmoji("🇬🇧")
      .setStyle(ButtonStyle.Primary)
  );
}

function canValidateAlliance(interaction) {
  if (!interaction.member) return false;

  const isAdmin = interaction.member.permissions.has(
    PermissionFlagsBits.ManageGuild
  );

  const isR4orR5 = interaction.member.roles.cache.some(
    role => role.name.includes("R4") || role.name.includes("R5")
  );

  return isAdmin || isR4orR5;
}

const commands = [
  {
    name: "ayuda",
    description: "Muestra todos los comandos del bot"
  },
  {
    name: "idioma",
    description: "Selecciona español o inglés"
  },
  {
    name: "alianza",
    description: "Muestra información de la alianza"
  },
  {
    name: "comunidad",
    description: "Muestra información de la comunidad"
  },
  {
    name: "panelroles",
    description: "Muestra el panel para elegir roles de combate"
  },
  {
    name: "traducir",
    description: "Traduce un texto",
    options: [
      {
        name: "texto",
        description: "Texto que quieres traducir",
        type: 3,
        required: true
      },
      {
        name: "idioma",
        description: "Idioma de destino",
        type: 3,
        required: true,
        choices: [
          { name: "🇪🇸 Español", value: "es" },
          { name: "🇬🇧 English", value: "en" }
        ]
      }
    ]
  },
  {
    name: "publicar",
    description: "Publica un mensaje para alianza o comunidad",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: "destino",
        description: "Dónde quieres publicar",
        type: 3,
        required: true,
        choices: [
          { name: "⚔️ Solo alianza", value: "alianza" },
          { name: "🌍 Reino / Comunidad", value: "comunidad" }
        ]
      },
      {
        name: "texto",
        description: "Mensaje que quieres publicar",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "configurar",
    description: "Configura el bot",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: "alianza",
        description: "Configura la alianza",
        type: 1,
        options: [
          {
            name: "nombre",
            description: "Nombre de la alianza",
            type: 3,
            required: true
          },
          {
            name: "reino",
            description: "Número o nombre del reino",
            type: 3,
            required: true
          },
          {
            name: "descripcion",
            description: "Descripción de la alianza",
            type: 3,
            required: false
          }
        ]
      },
      {
        name: "comunidad",
        description: "Configura la comunidad",
        type: 1,
        options: [
          {
            name: "nombre",
            description: "Nombre de la comunidad",
            type: 3,
            required: true
          },
          {
            name: "descripcion",
            description: "Descripción de la comunidad",
            type: 3,
            required: false
          },
          {
            name: "invitacion",
            description: "Enlace de invitación",
            type: 3,
            required: false
          }
        ]
      },
      {
        name: "canal_alianza",
        description: "Canal privado de anuncios de alianza",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal privado de la alianza",
            type: 7,
            required: true,
            channel_types: [ChannelType.GuildText]
          }
        ]
      },
      {
        name: "canal_comunidad",
        description: "Canal público del reino/comunidad",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal público de la comunidad",
            type: 7,
            required: true,
            channel_types: [ChannelType.GuildText]
          }
        ]
      },
      {
        name: "canal_solicitudes",
        description: "Canal privado para solicitudes de alianza",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal para validar nuevos miembros",
            type: 7,
            required: true,
            channel_types: [ChannelType.GuildText]
          }
        ]
      },
      {
        name: "bienvenida",
        description: "Selecciona el canal de bienvenida",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal de bienvenida",
            type: 7,
            required: true,
            channel_types: [ChannelType.GuildText]
          }
        ]
      },
      {
        name: "normas",
        description: "Selecciona el canal de normas",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal de normas",
            type: 7,
            required: true,
            channel_types: [ChannelType.GuildText]
          }
        ]
      },
      {
        name: "rol",
        description: "Configura el rol inicial de alianza",
        type: 1,
        options: [
          {
            name: "rol",
            description: "Normalmente selecciona R1",
            type: 8,
            required: true
          }
        ]
      },
      {
        name: "idioma",
        description: "Idioma predeterminado",
        type: 1,
        options: [
          {
            name: "idioma",
            description: "Idioma predeterminado",
            type: 3,
            required: true,
            choices: [
              { name: "🇪🇸 Español", value: "es" },
              { name: "🇬🇧 English", value: "en" }
            ]
          }
        ]
      },
      {
        name: "ver",
        description: "Muestra la configuración actual",
        type: 1
      }
    ]
  }
];

client.once(Events.ClientReady, async readyClient => {
  console.log("");
  console.log("======================================");
  console.log("✅ ROK ALLIANCE MANAGER CONECTADO");
  console.log(`🤖 Bot: ${readyClient.user.tag}`);
  console.log(`🌍 Servidores: ${readyClient.guilds.cache.size}`);
  console.log("======================================");
  console.log("");

  try {
    await readyClient.application.commands.set(commands);
    console.log(`✅ ${commands.length} comandos principales registrados.`);
  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
});

client.on("guildMemberAdd", async member => {
  if (member.user.bot) return;

  const config = getGuildConfig(member.guild.id);
  if (!config.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) return;

  const community = config.communityName || member.guild.name;
  const alliance = config.allianceName || "Sin configurar";
  const kingdom = config.kingdom || "Sin configurar";

  const welcomeText =
`👋 ¡Bienvenido/a ${member} a **${community}**!

⚔️ **Alianza:** ${alliance}
👑 **Reino:** ${kingdom}

¿A qué grupo perteneces?

🌍 **Reino / Comunidad**
Si eres jugador del reino o perteneces a otra alianza.

⚔️ **Miembro de la alianza**
Si perteneces a nuestra alianza.

🇬🇧 Welcome! Choose the option that applies to you below.`;

  const entryButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`join_community_${member.id}`)
      .setLabel("Reino / Comunidad")
      .setEmoji("🌍")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`join_alliance_${member.id}`)
      .setLabel("Miembro de la alianza")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Primary)
  );

  try {
    await channel.send({
      content: welcomeText,
      components: [entryButtons]
    });
  } catch (error) {
    console.error("❌ Error enviando bienvenida:", error);
  }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton()) {
      if (!interaction.guild) return;

      const roleButtonMap = {
        role_infanteria: "🛡️ Infantería",
        role_caballeria: "🐎 Caballería",
        role_arqueria: "🏹 Arquería",
        role_rally: "🔥 Rally Leader",
        role_garrison: "🏰 Garrison Leader"
      };

      if (roleButtonMap[interaction.customId]) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const roleName = roleButtonMap[interaction.customId];
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const role = interaction.guild.roles.cache.find(r => r.name === roleName);

          if (!role) {
            await interaction.editReply(
              `❌ No encuentro el rol **${roleName}** en el servidor.`
            );
            return;
          }

          const botMember = interaction.guild.members.me;

          if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.editReply(
              "❌ El bot no tiene permiso **Gestionar roles**."
            );
            return;
          }

          if (role.position >= botMember.roles.highest.position) {
            await interaction.editReply(
`❌ No puedo gestionar **${role.name}**.

Mueve el rol **ROK Alliance Manager** por encima de este rol en la lista de roles.`
            );
            return;
          }

          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            await interaction.editReply(
              `✅ Te he quitado el rol **${role.name}**.`
            );
            return;
          }

          const troopRoleNames = [
            "🛡️ Infantería",
            "🐎 Caballería",
            "🏹 Arquería"
          ];

          if (troopRoleNames.includes(role.name)) {
            const rolesToRemove = member.roles.cache.filter(
              r => troopRoleNames.includes(r.name) && r.id !== role.id
            );

            for (const oldRole of rolesToRemove.values()) {
              if (oldRole.position < botMember.roles.highest.position) {
                await member.roles.remove(oldRole);
              }
            }
          }

          await member.roles.add(role);
          await interaction.editReply(
            `✅ Se te ha asignado **${role.name}**.`
          );
        } catch (error) {
          console.error("❌ Error gestionando rol:", error);
          await interaction.editReply(
`❌ Ha ocurrido un error gestionando el rol.

Comprueba que el bot tenga **Gestionar roles** y que su rol esté por encima de los roles que debe asignar.`
          );
        }

        return;
      }

      if (interaction.customId.startsWith("join_community_")) {
        const targetUserId = interaction.customId.replace("join_community_", "");

        if (interaction.user.id !== targetUserId) {
          await interaction.reply({
            content: "❌ Este botón pertenece al nuevo miembro que acaba de entrar.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          content:
`🌍 **Registro completado**

Has entrado como miembro del **Reino / Comunidad**.

Puedes utilizar las zonas públicas del servidor.

No tienes acceso a los canales privados de la alianza.`,
          flags: MessageFlags.Ephemeral
        });

        try {
          await interaction.message.edit({ components: [] });
        } catch (error) {
          console.error("❌ Error quitando botones:", error);
        }

        return;
      }

      if (interaction.customId.startsWith("join_alliance_")) {
        const targetUserId = interaction.customId.replace("join_alliance_", "");

        if (interaction.user.id !== targetUserId) {
          await interaction.reply({
            content: "❌ Este botón pertenece al nuevo miembro que acaba de entrar.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const requestKey = `${interaction.guild.id}_${targetUserId}`;
        const existingRequest = database.requests[requestKey];

        if (existingRequest && existingRequest.status === "pending") {
          await interaction.reply({
            content: "🟡 Ya tienes una solicitud de alianza pendiente.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const config = getGuildConfig(interaction.guild.id);
        const requestChannelId =
          config.requestChannelId || config.allianceChannelId;

        if (!requestChannelId) {
          await interaction.reply({
            content:
`❌ No existe un canal de solicitudes configurado.

Un administrador debe usar:

\`/configurar canal_solicitudes\``,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const requestChannel =
          interaction.guild.channels.cache.get(requestChannelId);

        if (!requestChannel) {
          await interaction.reply({
            content: "❌ No encuentro el canal de solicitudes.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const approvalButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_alliance_${targetUserId}`)
            .setLabel("Aprobar como R1")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_alliance_${targetUserId}`)
            .setLabel("Rechazar")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
        );

        const requestEmbed = new EmbedBuilder()
          .setTitle("⚔️ Nueva solicitud de alianza")
          .setDescription(
`👤 **Usuario:** <@${targetUserId}>

🆔 **Discord ID:** ${targetUserId}

🟡 **Estado:** Pendiente

El usuario indica que pertenece a la alianza.

Un **R4, R5 o administrador** debe verificarlo antes de darle acceso privado.`
          )
          .setFooter({
            text: "ROK Alliance Manager • Verificación de miembros"
          });

        const requestMessage = await requestChannel.send({
          embeds: [requestEmbed],
          components: [approvalButtons]
        });

        database.requests[requestKey] = {
          status: "pending",
          userId: targetUserId,
          guildId: interaction.guild.id,
          messageId: requestMessage.id,
          createdAt: Date.now()
        };

        saveDatabase();

        await interaction.reply({
          content:
`⚔️ **Solicitud enviada correctamente**

Un **R4, R5 o administrador** comprobará que perteneces a la alianza.

🔒 Todavía no tienes acceso a los canales privados.

Si tu solicitud es aprobada recibirás automáticamente **R1**.`,
          flags: MessageFlags.Ephemeral
        });

        try {
          await interaction.message.edit({ components: [] });
        } catch (error) {
          console.error("❌ Error quitando botones:", error);
        }

        return;
      }

      if (interaction.customId.startsWith("approve_alliance_")) {
        const targetUserId =
          interaction.customId.replace("approve_alliance_", "");

        if (!canValidateAlliance(interaction)) {
          await interaction.reply({
            content: "❌ Solo un **R4, R5 o administrador** puede aprobar miembros.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const config = getGuildConfig(interaction.guild.id);

        if (!config.memberRoleId) {
          await interaction.reply({
            content:
`❌ No está configurado el rol inicial.

Utiliza:

\`/configurar rol\`

y selecciona **🔶 R1**.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const allianceRole =
          interaction.guild.roles.cache.get(config.memberRoleId);

        if (!allianceRole) {
          await interaction.reply({
            content: "❌ El rol R1 configurado ya no existe.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        let targetMember;

        try {
          targetMember = await interaction.guild.members.fetch(targetUserId);
        } catch {
          await interaction.reply({
            content: "❌ Ese usuario ya no está dentro del servidor.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        try {
          await targetMember.roles.add(allianceRole);
        } catch (error) {
          console.error("❌ Error asignando R1:", error);
          await interaction.reply({
            content:
`❌ No puedo asignar ${allianceRole}.

Comprueba que el rol **ROK Alliance Manager** esté por encima de R1 y tenga **Gestionar roles**.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const requestKey = `${interaction.guild.id}_${targetUserId}`;

        database.requests[requestKey] = {
          ...(database.requests[requestKey] || {}),
          status: "approved",
          approvedBy: interaction.user.id,
          approvedAt: Date.now()
        };

        saveDatabase();

        const approvedEmbed = new EmbedBuilder()
          .setTitle("✅ Miembro de alianza aprobado")
          .setDescription(
`👤 <@${targetUserId}>

✅ **Estado:** Aprobado

⚔️ **Aprobado por:** ${interaction.user}

🎭 **Rol asignado:** ${allianceRole}

🔒 El miembro ya puede acceder a los canales privados de la alianza.`
          );

        await interaction.update({
          embeds: [approvedEmbed],
          components: []
        });

        try {
          await targetMember.send(
`✅ Tu solicitud para entrar en la alianza de **${interaction.guild.name}** ha sido aprobada.

🎭 Se te ha asignado **${allianceRole.name}**.

Ya puedes acceder a las zonas privadas de la alianza.`
          );
        } catch {
          console.log("ℹ️ El usuario tiene los mensajes privados cerrados.");
        }

        return;
      }

      if (interaction.customId.startsWith("reject_alliance_")) {
        const targetUserId =
          interaction.customId.replace("reject_alliance_", "");

        if (!canValidateAlliance(interaction)) {
          await interaction.reply({
            content: "❌ Solo un **R4, R5 o administrador** puede rechazar solicitudes.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const requestKey = `${interaction.guild.id}_${targetUserId}`;

        database.requests[requestKey] = {
          ...(database.requests[requestKey] || {}),
          status: "rejected",
          rejectedBy: interaction.user.id,
          rejectedAt: Date.now()
        };

        saveDatabase();

        const rejectedEmbed = new EmbedBuilder()
          .setTitle("❌ Solicitud de alianza rechazada")
          .setDescription(
`👤 <@${targetUserId}>

❌ **Estado:** Rechazado

La solicitud ha sido rechazada por ${interaction.user}.

El usuario continuará teniendo únicamente acceso a **Reino / Comunidad**.`
          );

        await interaction.update({
          embeds: [rejectedEmbed],
          components: []
        });

        try {
          const targetMember =
            await interaction.guild.members.fetch(targetUserId);

          await targetMember.send(
`❌ Tu solicitud para acceder a la zona privada de la alianza de **${interaction.guild.name}** no ha sido aprobada.

Seguirás teniendo acceso a **Reino / Comunidad**.

Si crees que se trata de un error, contacta con un R4 o R5.`
          );
        } catch {
          console.log("ℹ️ No se pudo enviar DM al usuario rechazado.");
        }

        return;
      }

      if (interaction.customId === "language_es") {
        setUserLanguage(interaction.guild.id, interaction.user.id, "es");

        const saved = database.messages[interaction.message.id];

        await interaction.reply({
          content: saved
            ? `🇪🇸 **Español**\n\n${saved.spanish}`
            : "🇪🇸 Idioma configurado en **Español**.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId === "language_en") {
        setUserLanguage(interaction.guild.id, interaction.user.id, "en");

        const saved = database.messages[interaction.message.id];

        await interaction.reply({
          content: saved
            ? `🇬🇧 **English**\n\n${saved.english}`
            : "🇬🇧 Language set to **English**.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solamente funciona dentro de un servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);
    const language = getUserLanguage(guildId, interaction.user.id);

    if (interaction.commandName === "panelroles") {
      await interaction.deferReply();

      const panelEmbed = new EmbedBuilder()
        .setTitle("⚔️ Roles de combate")
        .setDescription(
`Selecciona tus roles.

🛡️ **Infantería**
🐎 **Caballería**
🏹 **Arquería**

Solo puedes tener una especialidad principal de tropas.

🔥 **Rally Leader**
🏰 **Garrison Leader**

Estos dos roles son adicionales y pueden combinarse con tu especialidad principal.

Pulsa otra vez un rol que ya tengas para quitártelo.`
        )
        .setFooter({
          text: "ROK Alliance Manager • Roles de combate"
        });

      const roleButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("role_infanteria")
          .setLabel("Infantería")
          .setEmoji("🛡️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("role_caballeria")
          .setLabel("Caballería")
          .setEmoji("🐎")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("role_arqueria")
          .setLabel("Arquería")
          .setEmoji("🏹")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("role_rally")
          .setLabel("Rally Leader")
          .setEmoji("🔥")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("role_garrison")
          .setLabel("Garrison Leader")
          .setEmoji("🏰")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [panelEmbed],
        components: [roleButtons]
      });

      return;
    }

    if (interaction.commandName === "idioma") {
      await interaction.reply({
        content: "🌍 **Selecciona tu idioma / Select your language**",
        components: [languageButtons()],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (interaction.commandName === "ayuda") {
      const embed = new EmbedBuilder()
        .setTitle("⚔️ ROK Alliance Manager");

      if (language === "en") {
        embed
          .setDescription(
            "Community and alliance management bot for Rise of Kingdoms."
          )
          .addFields(
            { name: "🌍 Language", value: "`/idioma`" },
            { name: "⚔️ Alliance", value: "`/alianza`" },
            { name: "👥 Community", value: "`/comunidad`" },
            { name: "🎭 Combat roles", value: "`/panelroles`" },
            { name: "🌐 Translator", value: "`/traducir`" },
            { name: "📢 Publications", value: "`/publicar`" },
            { name: "⚙️ Configuration", value: "`/configurar`" }
          );
      } else {
        embed
          .setDescription(
            "Bot para gestionar alianza y comunidad de Rise of Kingdoms."
          )
          .addFields(
            { name: "🌍 Idioma", value: "`/idioma`" },
            { name: "⚔️ Alianza", value: "`/alianza`" },
            { name: "👥 Comunidad", value: "`/comunidad`" },
            { name: "🎭 Roles de combate", value: "`/panelroles`" },
            { name: "🌐 Traductor", value: "`/traducir`" },
            { name: "📢 Publicaciones", value: "`/publicar`" },
            { name: "⚙️ Configuración", value: "`/configurar`" }
          );
      }

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (interaction.commandName === "traducir") {
      const text = interaction.options.getString("texto");
      const destination = interaction.options.getString("idioma");

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const translation = await translateText(text, destination);

      const embed = new EmbedBuilder()
        .setTitle(
          destination === "es"
            ? "🇪🇸 Traducción al español"
            : "🇬🇧 English translation"
        )
        .setDescription(translation);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "alianza") {
      let description = config.allianceDescription || "Sin descripción.";

      if (language === "en") {
        description = await translateText(description, "en");
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${config.allianceName || "Alianza"}`)
        .setDescription(description);

      if (language === "en") {
        embed.addFields(
          {
            name: "👑 Kingdom",
            value: config.kingdom || "Not configured",
            inline: true
          },
          {
            name: "👥 Discord Members",
            value: `${interaction.guild.memberCount}`,
            inline: true
          }
        );
      } else {
        embed.addFields(
          {
            name: "👑 Reino",
            value: config.kingdom || "No configurado",
            inline: true
          },
          {
            name: "👥 Miembros de Discord",
            value: `${interaction.guild.memberCount}`,
            inline: true
          }
        );
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "comunidad") {
      let description =
        config.communityDescription || "Comunidad de Rise of Kingdoms.";

      if (language === "en") {
        description = await translateText(description, "en");
      }

      const embed = new EmbedBuilder()
        .setTitle(`👥 ${config.communityName || interaction.guild.name}`)
        .setDescription(description);

      if (config.rulesChannelId) {
        embed.addFields({
          name: language === "en" ? "📜 Rules" : "📜 Normas",
          value: `<#${config.rulesChannelId}>`
        });
      }

      if (config.inviteLink) {
        embed.addFields({
          name: language === "en" ? "🔗 Invitation" : "🔗 Invitación",
          value: config.inviteLink
        });
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "publicar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "❌ Necesitas permiso de **Gestionar servidor**.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const destination = interaction.options.getString("destino");
      const text = interaction.options.getString("texto");

      let channelId = "";
      let publicationTitle = "";

      if (destination === "alianza") {
        channelId = config.allianceChannelId;
        publicationTitle = "⚔️ Mensaje de la alianza / Alliance Message";
      }

      if (destination === "comunidad") {
        channelId = config.communityChannelId;
        publicationTitle = "🌍 Mensaje de la comunidad / Community Message";
      }

      if (!channelId) {
        await interaction.reply({
          content:
            destination === "alianza"
              ? "❌ Configura primero `/configurar canal_alianza`."
              : "❌ Configura primero `/configurar canal_comunidad`.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const targetChannel = interaction.guild.channels.cache.get(channelId);

      if (!targetChannel) {
        await interaction.reply({
          content: "❌ No encuentro el canal configurado.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const spanish = await translateText(text, "es");
      const english = await translateText(text, "en");

      const embed = new EmbedBuilder()
        .setTitle(publicationTitle)
        .setDescription(
`🇪🇸 Pulsa **Español** para leer el mensaje.

🇬🇧 Press **English** to read the message.`
        )
        .setFooter({ text: "ROK Alliance Manager" });

      const sent = await targetChannel.send({
        embeds: [embed],
        components: [languageButtons()]
      });

      database.messages[sent.id] = { spanish, english };
      saveDatabase();

      await interaction.editReply({
        content:
          destination === "alianza"
            ? `✅ Mensaje publicado **solo para la alianza** en ${targetChannel}.`
            : `✅ Mensaje publicado para **Reino / Comunidad** en ${targetChannel}.`
      });

      return;
    }

    if (interaction.commandName === "configurar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "❌ Necesitas permiso de **Gestionar servidor**.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "alianza") {
        config.allianceName = interaction.options.getString("nombre");
        config.kingdom = interaction.options.getString("reino");
        config.allianceDescription =
          interaction.options.getString("descripcion") || "";

        saveDatabase();

        await interaction.reply({
          content:
`✅ **Alianza configurada**

⚔️ **Alianza:** ${config.allianceName}
👑 **Reino:** ${config.kingdom}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "comunidad") {
        config.communityName = interaction.options.getString("nombre");
        config.communityDescription =
          interaction.options.getString("descripcion") || "";
        config.inviteLink =
          interaction.options.getString("invitacion") || "";

        saveDatabase();

        await interaction.reply({
          content: "✅ Comunidad configurada correctamente.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "canal_alianza") {
        const channel = interaction.options.getChannel("canal");
        config.allianceChannelId = channel.id;
        saveDatabase();

        await interaction.reply({
          content:
`✅ Canal privado de alianza configurado: ${channel}

⚔️ Los mensajes de **Solo alianza** se enviarán aquí.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "canal_comunidad") {
        const channel = interaction.options.getChannel("canal");
        config.communityChannelId = channel.id;
        saveDatabase();

        await interaction.reply({
          content:
`✅ Canal de comunidad configurado: ${channel}

🌍 Los mensajes de **Reino / Comunidad** se enviarán aquí.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "canal_solicitudes") {
        const channel = interaction.options.getChannel("canal");
        config.requestChannelId = channel.id;
        saveDatabase();

        await interaction.reply({
          content:
`✅ Canal de solicitudes configurado: ${channel}

🛡️ Las solicitudes de nuevos miembros de la alianza aparecerán aquí.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "bienvenida") {
        const channel = interaction.options.getChannel("canal");
        config.welcomeChannelId = channel.id;
        saveDatabase();

        await interaction.reply({
          content: `✅ Canal de bienvenida: ${channel}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "normas") {
        const channel = interaction.options.getChannel("canal");
        config.rulesChannelId = channel.id;
        saveDatabase();

        await interaction.reply({
          content: `✅ Canal de normas: ${channel}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "rol") {
        const role = interaction.options.getRole("rol");
        const botMember = interaction.guild.members.me;

        if (botMember && role.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content:
`❌ No puedo asignar ${role}.

Coloca el rol **ROK Alliance Manager** por encima de ese rol.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        config.memberRoleId = role.id;
        saveDatabase();

        await interaction.reply({
          content: `✅ Rol inicial de alianza configurado: ${role}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "idioma") {
        const selected = interaction.options.getString("idioma");
        config.defaultLanguage = selected;
        saveDatabase();

        await interaction.reply({
          content:
            selected === "es"
              ? "✅ Idioma predeterminado: 🇪🇸 **Español**"
              : "✅ Default language: 🇬🇧 **English**",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subcommand === "ver") {
        const embed = new EmbedBuilder()
          .setTitle("⚙️ Configuración de ROK Alliance Manager")
          .addFields(
            {
              name: "⚔️ Alianza",
              value: config.allianceName || "No configurada"
            },
            {
              name: "👑 Reino",
              value: config.kingdom || "No configurado"
            },
            {
              name: "👥 Comunidad",
              value: config.communityName || "No configurada"
            },
            {
              name: "⚔️ Canal alianza",
              value: config.allianceChannelId
                ? `<#${config.allianceChannelId}>`
                : "No configurado"
            },
            {
              name: "🌍 Canal comunidad",
              value: config.communityChannelId
                ? `<#${config.communityChannelId}>`
                : "No configurado"
            },
            {
              name: "🛡️ Solicitudes",
              value: config.requestChannelId
                ? `<#${config.requestChannelId}>`
                : "No configurado"
            },
            {
              name: "👋 Bienvenida",
              value: config.welcomeChannelId
                ? `<#${config.welcomeChannelId}>`
                : "No configurada"
            },
            {
              name: "📜 Normas",
              value: config.rulesChannelId
                ? `<#${config.rulesChannelId}>`
                : "No configuradas"
            },
            {
              name: "🔶 Rol inicial",
              value: config.memberRoleId
                ? `<@&${config.memberRoleId}>`
                : "No configurado"
            },
            {
              name: "🌍 Idioma",
              value:
                config.defaultLanguage === "en"
                  ? "🇬🇧 English"
                  : "🇪🇸 Español"
            }
          );

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
  } catch (error) {
    console.error("❌ ERROR EN INTERACTION:", error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "⚠️ Ha ocurrido un error ejecutando el comando.",
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: "⚠️ Ha ocurrido un error ejecutando el comando.",
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (secondError) {
      console.error("❌ No se pudo responder al error:", secondError);
    }
  }
});

client.on("error", error => {
  console.error("❌ Error de Discord:", error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Promesa rechazada:", error);
});

loadDatabase();

console.log("🚀 Iniciando ROK Alliance Manager...");
client.login(TOKEN);