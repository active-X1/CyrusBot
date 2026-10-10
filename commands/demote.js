// commands/demote.js  (owner only, groups only, bot must be admin)
//   .demote @user   |   reply to someone with .demote   |   .demote <number>
// Logic is shared with the other role command in lib/groupAdmin.js.
const { changeRole } = require('../lib/groupAdmin');

module.exports = {
  name: 'demote',
  aliases: [],
  description: 'Remove admin',
  usage: '@user',
  emoji: '⬇️',
  category: 'admin',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    await changeRole(sock, msg, args, ctx, 'demote');
  },
};
