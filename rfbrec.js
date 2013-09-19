var rfb     = require('rfb2');
var spawn   = require('child_process').spawn;
var program = require('commander');
var prompt  = require('co-prompt');

program
  .version('0.0.1')
  .option('-p, --port', 'RFB port')
  .option('-h, --host', 'RFB host')
  .option('-w, --password', 'password')
  .option('-o, --output', 'output file name')
  .option('-c, --codec', 'video codec')
  .option('-r, --rate', 'frame rate')
  .parse(process.argv);

function getPassword(cb) {
  prompt.password('VNC password:', '')(function(err, password) {
    cb(password);
  });
}

var r = rfb.createConnection({
  host: program.host || '127.0.0.1',
  port: program.port || 5901,
  password: program.password,
  credentialsCallback: getPassword
});

r.on('connect', function() {

  // http://netpbm.sourceforge.net/doc/ppm.html
  var ppmHeader = Buffer(['P6', r.width + ' ' + r.height, '255\n'].join('\n'));
  var screen = new Buffer(r.width*r.height*3);

  // TODO: command line switch to pass ffmpeg flags
  // TODO: frame rate from flags
  // TODO: path
  var out = spawn('/usr/local/bin/ffmpeg', '-f image2pipe -vcodec ppm -r 20 -i - -r 20 -c:v libx264 -preset slow -crf 22 -c:a copy video.avi'.split(' '));
 
  out.stdout.pipe(process.stdout);
  out.stderr.pipe(process.stderr);

  var interval = setInterval(function() {
    out.stdin.write(ppmHeader);
    out.stdin.write(screen);
  }, 50);

  process.on('SIGINT', function() {
    clearInterval(interval);
    out.stdin.end();
    r.stream.end();
  });

  r.on('rect', function(rect) {
    for(var y=rect.y; y < rect.y + rect.height; ++y) {
      for(var x=rect.x; x < rect.x + rect.width; ++x) {
	var idx = (r.width*y + x)*3
	var bdx = (rect.width*(y - rect.y) + (x - rect.x)) << 2;
	screen[idx + 2] = rect.buffer[bdx];
	screen[idx + 1] = rect.buffer[bdx + 1];
	screen[idx + 0] = rect.buffer[bdx + 2];
      }
    }
  });
});

