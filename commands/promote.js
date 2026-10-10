// commands/promote.js  (owner only, groups only, bot must be admin)
//   .promote @user   |   reply to someone with .promote   |   .promote <number>
// Logic is shared with the other role command in lib/groupAdmin.js.
const { changeRole } = require('../lib/groupAdmin');

module.exports = {
  name: 'promote',
  aliases: [],
  description: 'Make someone admin',
  emoji: '⬆️',
  category: 'admin',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    await changeRole(sock, msg, args, ctx, 'promote');
  },
};
