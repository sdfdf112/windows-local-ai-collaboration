const fs = require('fs');
let c = fs.readFileSync('E:/ClawCommunication/scripts/platform.js', 'utf8');

// 修复 renderDiscussions - 使用双引号替代单引号避免转义问题
c = c.replace(
  /viewDiscussion\('' \+ d\.filename \+ '\)'/g,
  "viewDiscussion(&quot; + d.filename + &quot;)"
);

fs.writeFileSync('E:/ClawCommunication/scripts/platform.js', c);
console.log('Fixed!');
