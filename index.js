const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const translate = require("translate-google");
require("dotenv").config();


// ======================================================
// CONFIGURACIÓN GENERAL
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ ERROR: No existe la variable DISCORD_TOKEN.");
  process.exit(1);
}


// ======================================================
// CLIENTE DISCORD
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});


// ======================================================
// BASE DE DATOS JSON
// ======================================================

const DATA_FILE = path.join(__dirname, "data.json");

let database = {
  guilds: {},
  users: {},
  messages: {}
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
}


function saveDatabase() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(database, null, 2),
      "utf8"
    );
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

  // NUEVOS CANALES
  if (config.allianceChannelId === undefined) config.allianceChannelId = "";
  if (config.communityChannelId === undefined) config.communityChannelId = "";

  if (config.memberRoleId === undefined) config.memberRoleId = "";
  if (config.defaultLanguage === undefined) config.defaultLanguage = "es";
  if (config.inviteLink === undefined) config.inviteLink = "";

  saveDatabase();

  return config;
}


function getUserLanguage(guildId, userId) {
  const key = `${guildId}_${userId}`;

  if (database.users[key]) {
    return database.users[key];
  }

  return getGuildConfig(guildId).defaultLanguage || "es";
}


function setUserLanguage(guildId, userId, language) {
  const key = `${guildId}_${userId}`;

  database.users[key] = language;

  saveDatabase();
}


// ======================================================
// TRADUCCIÓN
// ======================================================

async function translateText(text, targetLanguage) {
  try {
    const result = await translate(text, {
      to: targetLanguage
    });

    return result;
  } catch (error) {
    console.error("❌ Error traduciendo:", error);

    if (targetLanguage === "es") {
      return "⚠️ No se pudo realizar la traducción.";
    }

    return "⚠️ Translation could not be completed.";
  }
}


// ======================================================
// BOTONES DE IDIOMA
// ======================================================

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


// ======================================================
// COMANDOS
// ======================================================

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
          {
            name: "🇪🇸 Español",
            value: "es"
          },
          {
            name: "🇬🇧 English",
            value: "en"
          }
        ]
      }
    ]
  },


  // ====================================================
  // PUBLICAR
  // ====================================================

  {
    name: "publicar",
    description: "Publica un mensaje para la alianza o la comunidad",

    default_member_permissions:
      PermissionFlagsBits.ManageGuild.toString(),

    options: [

      {
        name: "destino",
        description: "Dónde quieres publicar",
        type: 3,
        required: true,

        choices: [
          {
            name: "⚔️ Solo alianza",
            value: "alianza"
          },

          {
            name: "🌍 Reino / Comunidad",
            value: "comunidad"
          }
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


  // ====================================================
  // CONFIGURAR
  // ====================================================

  {
    name: "configurar",
    description: "Configura el bot",

    default_member_permissions:
      PermissionFlagsBits.ManageGuild.toString(),

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


      // NUEVO
      {
        name: "canal_alianza",
        description: "Configura el canal privado de la alianza",
        type: 1,

        options: [
          {
            name: "canal",
            description: "Canal privado de la alianza",
            type: 7,
            required: true,
            channel_types: [
              ChannelType.GuildText
            ]
          }
        ]
      },


      // NUEVO
      {
        name: "canal_comunidad",
        description: "Configura el canal público del reino o comunidad",
        type: 1,

        options: [
          {
            name: "canal",
            description: "Canal público de la comunidad",
            type: 7,
            required: true,
            channel_types: [
              ChannelType.GuildText
            ]
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
            channel_types: [
              ChannelType.GuildText
            ]
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
            channel_types: [
              ChannelType.GuildText
            ]
          }
        ]
      },


      {
        name: "rol",
        description: "Configura el rol automático de alianza",
        type: 1,

        options: [
          {
            name: "rol",
            description: "Rol de los miembros de la alianza",
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
              {
                name: "🇪🇸 Español",
                value: "es"
              },

              {
                name: "🇬🇧 English",
                value: "en"
              }
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


// ======================================================
// BOT LISTO
// ======================================================

client.once("clientReady", async () => {

  console.log("");
  console.log("======================================");
  console.log("✅ ROK ALLIANCE MANAGER CONECTADO");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🌍 Servidores: ${client.guilds.cache.size}`);
  console.log("======================================");
  console.log("");

  try {

    await client.application.commands.set(commands);

    console.log(
      `✅ ${commands.length} comandos principales registrados.`
    );

  } catch (error) {

    console.error(
      "❌ Error registrando comandos:",
      error
    );

  }

});


// ======================================================
// NUEVO MIEMBRO
// ======================================================

client.on("guildMemberAdd", async member => {

  if (member.user.bot) return;

  const config = getGuildConfig(member.guild.id);


  // ====================================================
  // ROL AUTOMÁTICO
  // ====================================================

  if (config.memberRoleId) {

    try {

      const role =
        member.guild.roles.cache.get(
          config.memberRoleId
        );

      if (role) {
        await member.roles.add(role);
      }

    } catch (error) {

      console.error(
        "❌ No se pudo asignar el rol:",
        error
      );

    }

  }


  // ====================================================
  // BIENVENIDA
  // ====================================================

  if (!config.welcomeChannelId) return;

  const channel =
    member.guild.channels.cache.get(
      config.welcomeChannelId
    );

  if (!channel) return;


  const community =
    config.communityName ||
    member.guild.name;

  const alliance =
    config.allianceName ||
    "Sin configurar";

  const kingdom =
    config.kingdom ||
    "Sin configurar";


  const spanishText =
`👋 ¡Bienvenido/a ${member} a **${community}**!

⚔️ **Alianza:** ${alliance}
👑 **Reino:** ${kingdom}

🌍 Selecciona tu idioma usando los botones de abajo.

Esperamos que disfrutes de nuestra comunidad. ❤️`;


  const englishText =
`👋 Welcome ${member} to **${community}**!

⚔️ **Alliance:** ${alliance}
👑 **Kingdom:** ${kingdom}

🌍 Choose your language using the buttons below.

We hope you enjoy our community. ❤️`;


  try {

    const message = await channel.send({

      content: spanishText,

      components: [
        languageButtons()
      ]

    });


    database.messages[message.id] = {
      spanish: spanishText,
      english: englishText
    };


    saveDatabase();

  } catch (error) {

    console.error(
      "❌ Error enviando bienvenida:",
      error
    );

  }

});


// ======================================================
// INTERACCIONES
// ======================================================

client.on("interactionCreate", async interaction => {

  try {


    // ==================================================
    // BOTONES
    // ==================================================

    if (interaction.isButton()) {

      if (!interaction.guild) return;


      if (interaction.customId === "language_es") {

        setUserLanguage(
          interaction.guild.id,
          interaction.user.id,
          "es"
        );


        const saved =
          database.messages[
            interaction.message.id
          ];


        if (saved) {

          await interaction.reply({

            content:
`🇪🇸 **Español**

${saved.spanish}`,

            ephemeral: true

          });

        } else {

          await interaction.reply({

            content:
              "🇪🇸 Idioma configurado en **Español**.",

            ephemeral: true

          });

        }

        return;
      }


      if (interaction.customId === "language_en") {

        setUserLanguage(
          interaction.guild.id,
          interaction.user.id,
          "en"
        );


        const saved =
          database.messages[
            interaction.message.id
          ];


        if (saved) {

          await interaction.reply({

            content:
`🇬🇧 **English**

${saved.english}`,

            ephemeral: true

          });

        } else {

          await interaction.reply({

            content:
              "🇬🇧 Language set to **English**.",

            ephemeral: true

          });

        }

        return;
      }

    }


    // ==================================================
    // SLASH COMMANDS
    // ==================================================

    if (!interaction.isChatInputCommand()) {
      return;
    }


    if (!interaction.guild) {

      await interaction.reply({

        content:
          "❌ Este comando solamente funciona dentro de un servidor.",

        ephemeral: true

      });

      return;
    }


    const guildId =
      interaction.guild.id;

    const config =
      getGuildConfig(guildId);

    const language =
      getUserLanguage(
        guildId,
        interaction.user.id
      );


    // ==================================================
    // /IDIOMA
    // ==================================================

    if (interaction.commandName === "idioma") {

      await interaction.reply({

        content:
          "🌍 **Selecciona tu idioma / Select your language**",

        components: [
          languageButtons()
        ],

        ephemeral: true

      });

      return;
    }


    // ==================================================
    // /AYUDA
    // ==================================================

    if (interaction.commandName === "ayuda") {

      const embed =
        new EmbedBuilder();


      if (language === "en") {

        embed
          .setTitle(
            "⚔️ ROK Alliance Manager"
          )

          .setDescription(
            "Community and alliance management bot for Rise of Kingdoms."
          )

          .addFields(

            {
              name: "🌍 Language",
              value: "`/idioma`"
            },

            {
              name: "⚔️ Alliance",
              value: "`/alianza`"
            },

            {
              name: "👥 Community",
              value: "`/comunidad`"
            },

            {
              name: "🌐 Translator",
              value: "`/traducir`"
            },

            {
              name: "📢 Publications",
              value: "`/publicar`"
            },

            {
              name: "⚙️ Configuration",
              value: "`/configurar`"
            }

          );

      } else {

        embed
          .setTitle(
            "⚔️ ROK Alliance Manager"
          )

          .setDescription(
            "Bot para gestionar la alianza y la comunidad de Rise of Kingdoms."
          )

          .addFields(

            {
              name: "🌍 Idioma",
              value: "`/idioma`"
            },

            {
              name: "⚔️ Alianza",
              value: "`/alianza`"
            },

            {
              name: "👥 Comunidad",
              value: "`/comunidad`"
            },

            {
              name: "🌐 Traductor",
              value: "`/traducir`"
            },

            {
              name: "📢 Publicaciones",
              value: "`/publicar`"
            },

            {
              name: "⚙️ Configuración",
              value: "`/configurar`"
            }

          );

      }


      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      return;
    }


    // ==================================================
    // /TRADUCIR
    // ==================================================

    if (interaction.commandName === "traducir") {

      const text =
        interaction.options.getString(
          "texto"
        );

      const destination =
        interaction.options.getString(
          "idioma"
        );


      await interaction.deferReply({
        ephemeral: true
      });


      const translation =
        await translateText(
          text,
          destination
        );


      const embed =
        new EmbedBuilder()

          .setTitle(
            destination === "es"
              ? "🇪🇸 Traducción al español"
              : "🇬🇧 English translation"
          )

          .setDescription(
            translation
          );


      await interaction.editReply({
        embeds: [embed]
      });

      return;
    }


    // ==================================================
    // /ALIANZA
    // ==================================================

    if (interaction.commandName === "alianza") {

      let description =
        config.allianceDescription ||
        "Sin descripción.";


      if (language === "en") {

        description =
          await translateText(
            description,
            "en"
          );

      }


      const embed =
        new EmbedBuilder()

          .setTitle(
            `⚔️ ${
              config.allianceName ||
              "Alianza"
            }`
          )

          .setDescription(
            description
          );


      if (language === "en") {

        embed.addFields(

          {
            name: "👑 Kingdom",
            value:
              config.kingdom ||
              "Not configured",
            inline: true
          },

          {
            name: "👥 Discord Members",
            value:
              `${interaction.guild.memberCount}`,
            inline: true
          }

        );

      } else {

        embed.addFields(

          {
            name: "👑 Reino",
            value:
              config.kingdom ||
              "No configurado",
            inline: true
          },

          {
            name: "👥 Miembros de Discord",
            value:
              `${interaction.guild.memberCount}`,
            inline: true
          }

        );

      }


      await interaction.reply({
        embeds: [embed]
      });

      return;
    }


    // ==================================================
    // /COMUNIDAD
    // ==================================================

    if (interaction.commandName === "comunidad") {

      let description =
        config.communityDescription ||
        "Comunidad de Rise of Kingdoms.";


      if (language === "en") {

        description =
          await translateText(
            description,
            "en"
          );

      }


      const embed =
        new EmbedBuilder()

          .setTitle(
            `👥 ${
              config.communityName ||
              interaction.guild.name
            }`
          )

          .setDescription(
            description
          );


      if (config.rulesChannelId) {

        embed.addFields({

          name:
            language === "en"
              ? "📜 Rules"
              : "📜 Normas",

          value:
            `<#${config.rulesChannelId}>`,

          inline: false

        });

      }


      if (config.inviteLink) {

        embed.addFields({

          name:
            language === "en"
              ? "🔗 Invitation"
              : "🔗 Invitación",

          value:
            config.inviteLink,

          inline: false

        });

      }


      await interaction.reply({
        embeds: [embed]
      });

      return;
    }


    // ==================================================
    // /PUBLICAR
    // ==================================================

    if (interaction.commandName === "publicar") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {

        await interaction.reply({

          content:
            "❌ Necesitas permiso de **Gestionar servidor**.",

          ephemeral: true

        });

        return;
      }


      const destination =
        interaction.options.getString(
          "destino"
        );

      const text =
        interaction.options.getString(
          "texto"
        );


      let channelId = "";
      let publicationTitle = "";


      if (destination === "alianza") {

        channelId =
          config.allianceChannelId;

        publicationTitle =
          "⚔️ Mensaje de la alianza / Alliance Message";

      }


      if (destination === "comunidad") {

        channelId =
          config.communityChannelId;

        publicationTitle =
          "🌍 Mensaje de la comunidad / Community Message";

      }


      if (!channelId) {

        await interaction.reply({

          content:
destination === "alianza"
  ? "❌ Todavía no has configurado el canal privado de la alianza.\n\nUsa `/configurar canal_alianza`."
  : "❌ Todavía no has configurado el canal de la comunidad.\n\nUsa `/configurar canal_comunidad`.",

          ephemeral: true

        });

        return;
      }


      const targetChannel =
        interaction.guild.channels.cache.get(
          channelId
        );


      if (!targetChannel) {

        await interaction.reply({

          content:
            "❌ No encuentro el canal configurado. Vuelve a configurarlo.",

          ephemeral: true

        });

        return;
      }


      await interaction.deferReply({
        ephemeral: true
      });


      const spanish =
        await translateText(
          text,
          "es"
        );


      const english =
        await translateText(
          text,
          "en"
        );


      const embed =
        new EmbedBuilder()

          .setTitle(
            publicationTitle
          )

          .setDescription(
`🇪🇸 Pulsa **Español** para leer el mensaje.

🇬🇧 Press **English** to read the message.`
          )

          .setFooter({
            text:
              "ROK Alliance Manager"
          });


      const sent =
        await targetChannel.send({

          embeds: [embed],

          components: [
            languageButtons()
          ]

        });


      database.messages[sent.id] = {
        spanish,
        english
      };


      saveDatabase();


      await interaction.editReply({

        content:
destination === "alianza"
  ? `✅ Mensaje publicado **solo para la alianza** en ${targetChannel}.`
  : `✅ Mensaje publicado para **reino/comunidad** en ${targetChannel}.`

      });

      return;
    }


    // ==================================================
    // /CONFIGURAR
    // ==================================================

    if (interaction.commandName === "configurar") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {

        await interaction.reply({

          content:
            "❌ Necesitas permiso de **Gestionar servidor**.",

          ephemeral: true

        });

        return;
      }


      const subcommand =
        interaction.options.getSubcommand();


      // ================================================
      // ALIANZA
      // ================================================

      if (subcommand === "alianza") {

        config.allianceName =
          interaction.options.getString(
            "nombre"
          );

        config.kingdom =
          interaction.options.getString(
            "reino"
          );

        config.allianceDescription =
          interaction.options.getString(
            "descripcion"
          ) || "";


        saveDatabase();


        await interaction.reply({

          content:
`✅ **Alianza configurada**

⚔️ **Alianza:** ${config.allianceName}
👑 **Reino:** ${config.kingdom}`,

          ephemeral: true

        });

        return;
      }


      // ================================================
      // COMUNIDAD
      // ================================================

      if (subcommand === "comunidad") {

        config.communityName =
          interaction.options.getString(
            "nombre"
          );


        config.communityDescription =
          interaction.options.getString(
            "descripcion"
          ) || "";


        config.inviteLink =
          interaction.options.getString(
            "invitacion"
          ) || "";


        saveDatabase();


        await interaction.reply({

          content:
            "✅ Comunidad configurada correctamente.",

          ephemeral: true

        });

        return;
      }


      // ================================================
      // CANAL ALIANZA
      // ================================================

      if (subcommand === "canal_alianza") {

        const channel =
          interaction.options.getChannel(
            "canal"
          );


        config.allianceChannelId =
          channel.id;


        saveDatabase();


        await interaction.reply({

          content:
`✅ Canal privado de alianza configurado: ${channel}

⚔️ Los mensajes de **Solo alianza** se enviarán aquí.`,

          ephemeral: true

        });

        return;
      }


      // ================================================
      // CANAL COMUNIDAD
      // ================================================

      if (subcommand === "canal_comunidad") {

        const channel =
          interaction.options.getChannel(
            "canal"
          );


        config.communityChannelId =
          channel.id;


        saveDatabase();


        await interaction.reply({

          content