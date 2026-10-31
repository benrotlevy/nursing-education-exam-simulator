const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('questions.js', 'utf8');
const target = '<script src="questions.js"></script>';

if (html.includes(target)) {
  const standalone = html.replace(target, '<script>\n' + js + '\n</script>');
  fs.writeFileSync('simulator_all_in_one.html', standalone, 'utf8');
  console.log('Successfully regenerated simulator_all_in_one.html (' + standalone.length + ' bytes)');
} else {
  console.error('Target script tag not found in index.html!');
  process.exit(1);
}
