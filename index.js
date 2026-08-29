const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([
      {
        name: "setup",
        description: "Configura automáticamente el servidor de Rise of Kingdoms"
     },
  {
    name: "panelroles",
    description: "Publica el panel para elegir tipo de tropa"
  }
]);
}
  

  console.log("✅ Comando /setup registrado");
});




client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    const roles = {
  rol_infanteria: "🛡️ Infantería",
  rol_caballeria: "🐎 Caballería",
  rol_arqueria: "🏹 Arquería",
  rol_rally: "🔥 Rally Leader",
  rol_garrison: "🏰 Garrison Leader"
};
  

  const roleName = roles[interaction.customId];
  if (!roleName) return;

  const role = interaction.guild.roles.cache.find(r => r.name === roleName);

  if (!role) {
    return interaction.reply({
      content: `❌ No encuentro el rol ${roleName}.`,
      ephemeral: true
    });
  } 
    const specialRoleIds = ["rol_rally", "rol_garrison"];

if (specialRoleIds.includes(interaction.customId)) {
  if (interaction.member.roles.cache.has(role.id)) {
    await interaction.member.roles.remove(role);

    return interaction.reply({
      content: `➖ Te he quitado el rol ${roleName}.`,
      ephemeral: true
    });
  }

  await interaction.member.roles.add(role);

  return interaction.reply({
    content: `✅ Ahora tienes el rol ${roleName}.`,
    ephemeral: true
  });
}
const troopRoleNames = [
  roles.rol_infanteria,
  roles.rol_caballeria,
  roles.rol_arqueria
];

for (const troopRoleName of troopRoleNames) {
  const troopRole = interaction.guild.roles.cache.find(
    r => r.name === troopRoleName
  );

  if (
    troopRole &&
    troopRole.id !== role.id &&
    interaction.member.roles.cache.has(troopRole.id)
  ) {
    await interaction.member.roles.remove(troopRole);
  }
}

if (!interaction.member.roles.cache.has(role.id)) {
  await interaction.member.roles.add(role);
}

return interaction.reply({
  content: `✅ Tu tropa principal ahora es ${roleName}.`,
  ephemeral: true
});
  
}
  if (interaction.commandName === "panelroles") {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rol_infanteria")
      .setLabel("Infantería")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("rol_caballeria")
      .setLabel("Caballería")
      .setEmoji("🐎")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("rol_arqueria")
      .setLabel("Arquería")
      .setEmoji("🏹")
      .setStyle(ButtonStyle.Primary) ,

new ButtonBuilder()
  .setCustomId("rol_rally")
  .setLabel("Rally Leader")
  .setEmoji("🔥")
  .setStyle(ButtonStyle.Success),

new ButtonBuilder()
  .setCustomId("rol_garrison")
  .setLabel("Garrison Leader")
  .setEmoji("🏰")
  .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({
    content: "⚔️ **Elige tu tipo de tropa principal:**",
    components: [row]
  });
}
 console.log("📥 Interacción recibida:", interaction.type, interaction.commandName); if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setup") {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Solo el propietario del servidor puede ejecutar este comando.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    try {
      // ROLES
      const roleNames = [
        "👑 R5 • Líder",
        "🛡️ R4 • Oficial",
        "⚔️ R3",
        "🔹 R2",
        "🔸 R1",
        "🔥 Rally Leader",
        "🏰 Garrison Leader",
        "🛡️ Infantería",
        "🐎 Caballería",
        "🏹 Arquería"
      ];

      const roles = {};

      for (const name of roleNames) {
        let role = guild.roles.cache.find(r => r.name === name);

        if (!role) {
          role = await guild.roles.create({
            name,
            reason: "Configuración automática ROK"
          });
        }

        roles[name] = role;
      }
const r5Role = roles["👑 R5 • Líder"];
const owner = await guild.fetchOwner();

if (r5Role && !owner.roles.cache.has(r5Role.id)) {
  await owner.roles.add(r5Role);
}
      async function createCategory(name, privateR4 = false) {
        let category = guild.channels.cache.find(
          c => c.name === name && c.type === ChannelType.GuildCategory
        );

        if (!category) {
          const overwrites = [];

          if (privateR4) {
            overwrites.push(
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: roles["🛡️ R4 • Oficial"].id,
                allow: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: roles["👑 R5 • Líder"].id,
                allow: [PermissionFlagsBits.ViewChannel]
              }
            );
          }

          category = await guild.channels.create({
            name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: overwrites
          });
        }

        return category;
      }

      async function textChannel(name, category) {
        if (!guild.channels.cache.find(c => c.name === name)) {
          await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: category.id
          });
        }
      }

      async function voiceChannel(name, category) {
        if (!guild.channels.cache.find(c => c.name === name)) {
          await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: category.id
          });
        }
      }

      // INFORMACIÓN
      const info = await createCategory("🏰 INFORMACIÓN • ALIANZA");

      await textChannel("👋・bienvenida", info);
      await textChannel("📜・reglas", info);
      await textChannel("📢・anuncios", info);
      await textChannel("🎭・roles", info);
      await textChannel("📚・guias", info);

      // COMUNIDAD
      const comunidad = await createCategory("💬 COMUNIDAD");

      await textChannel("💬・general", comunidad);
      await textChannel("📸・capturas", comunidad);
      await textChannel("❓・preguntas", comunidad);
      await textChannel("🎮・off-topic", comunidad);

      // GUERRA
      const guerra = await createCategory("⚔️ GUERRA");

      await textChannel("📢・ordenes-de-guerra", guerra);
      await textChannel("🎯・objetivos", guerra);
      await textChannel("🔥・rallies", guerra);
      await textChannel("🏰・guarniciones", guerra);
      await textChannel("📊・reportes", guerra);
      await textChannel("📍・coordenadas", guerra);

      // KVK
      const kvk = await createCategory("🔥 KVK");

      await textChannel("📢・kvk-ordenes", kvk);
      await textChannel("🗺️・kvk-planificacion", kvk);
      await textChannel("🔥・kvk-rallies", kvk);
      await textChannel("🏰・kvk-guarniciones", kvk);
      await textChannel("📍・kvk-coordenadas", kvk);

      // EVENTOS
      const eventos = await createCategory("🏆 EVENTOS");

      await textChannel("📅・calendario", eventos);
      await textChannel("🏆・arca-de-osiris", eventos);
      await textChannel("⚔️・mge", eventos);
      await textChannel("🔥・karuak", eventos);
      await textChannel("🎉・eventos-alianza", eventos);

      // R4 / R5 PRIVADO
      const liderazgo = await createCategory("🔒 R4 • R5", true);

      await textChannel("🧠・estrategia", liderazgo);
      await textChannel("🤝・diplomacia", liderazgo);
      await textChannel("👥・gestion-miembros", liderazgo);
      await textChannel("📋・planificacion", liderazgo);

      // VOZ
      const voz = await createCategory("🔊 CANALES DE VOZ");

      await voiceChannel("🔊 General", voz);
      await voiceChannel("⚔️ Guerra 1", voz);
      await voiceChannel("⚔️ Guerra 2", voz);
      await voiceChannel("🔥 Rallies", voz);
      await voiceChannel("🏆 Arca de Osiris", voz);

      const vozPrivada = await createCategory("🔒 VOZ R4 • R5", true);

      await voiceChannel("👑 Sala R4-R5", vozPrivada);

      await interaction.editReply(
        "✅ Servidor Rise of Kingdoms configurado correctamente."
      );

    } catch (error) {
      console.error(error);

      await interaction.editReply(
        "❌ Se produjo un error durante la configuración. Revisa los permisos del bot."
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
