/**
 * Created by Andrew Rapo on 12/9/15.
 */
var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer');
var fs = require('fs');
var childProcess = require('child_process');

var upload = multer();
var app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.raw({ type: 'audio/wav', limit: '50mb' }));

var port = 3000;
var host = 'localhost';

var post_url;
var html;
var colorsOn = true;
var urlOn = false;

post_url = 'http://' + host + ':' + port;

try {
    html = fs.readFileSync('web/index.html');
    html = html.toString();
    html = html.replace(/POST_URL/, post_url);
} catch (e) {
    html = '<html><body><code>' + e + '</code></body></html>';
}

var post_url_div;
var filename_div;

if (urlOn) {
    post_url_div = document.getElementById('post-url');
    filename_div = document.getElementById('filename');
    post_url_div.innerHTML = post_url;
}

console.log('host, port: ', host, post_url);

app.get('/', function(req, res){
    console.log('GET /');
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
});

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var buf;
var fft;
var samples = 64;
var audio_is_playing = false;
var volume = 100;

var canvas_width;
var canvas_height;
setupCanvas();

app.post('/', upload.single('audio'), function (req, res, next) {
    console.log("RECEIVED AUDIO: ", req.body, req.file);
    if (req.file) {
        if (urlOn) {
            filename_div.innerHTML = req.file.originalname;
        }

        fs.writeFile('web/audio_file', req.file.buffer, function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }

    //html = fs.readFileSync('web/index.html');
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);

    if (req.file) {
        playByteArray(req.file.buffer);
    }
});

app.listen(port);
console.log('Listening at http://' + host + ':' + port);


function playByteArray(byteArray) {
    var arrayBuffer = new ArrayBuffer(byteArray.length);
    var bufferView = new Uint8Array(arrayBuffer);
    for (i = 0; i < byteArray.length; i++) {
        bufferView[i] = byteArray[i];
    }

    playArrayBuffer(arrayBuffer);
}

function playArrayBuffer(arrayBuffer) {
    audioCtx.decodeAudioData(arrayBuffer, function(buffer) {
        buf = buffer;
        play();
    });
}

// Play the loaded file

var audio_source

function play() {
    // Create a audio_source node from the buffer
    audio_source = audioCtx.createBufferSource();
    audio_source.buffer = buf;

    //create fft
    fft = audioCtx.createAnalyser();
    fft.fftSize = samples;

    //connect them up into a chain
    audio_source.connect(fft);

    // Connect to the final output node (the speakers)
    fft.connect(audioCtx.destination);

    audio_source.onended = function()
    {
        console.log("ENDED");
        audio_is_playing = false;
    };

    // Play immediately
    audio_source.start(0);

    audio_is_playing = true;
}

var gfx;
var canvas_is_cleared = false;

function setupCanvas() {
    var canvas = document.getElementById('canvas');
    canvas_width = canvas.width;
    canvas_height = canvas.height;
    console.log('canvas width, height: ' + canvas_width + ', ' + canvas_height);
    gfx = canvas.getContext('2d');
    document.onmousedown = mouseDown;
    requestAnimationFrame(update);
}

function mouseDown(e) {
    console.log('mouseDown: ' + e);
    //var audio = new Audio();
    //audio.src = './web/audio_file';
    //audio.play();

    if (e.pageX < 1150 && e.pageX > 100) {
        if (!audio_is_playing) {
            var req = new XMLHttpRequest();
            req.open("GET", "./web/audio_file", true);
            req.responseType = "arraybuffer";
            req.onload = function () {
                playArrayBuffer(req.response);
            };
            req.send();
        } else {
            if (audio_source) {
                audio_source.stop();
            }
        }
    } else {
        if (e.pageY > 209 && e.pageY < 309) {
            console.log('LOUDER');
            volume += 10;
        } else if (e.pageY > 309 && e.pageY < 409) {
            console.log('STOP');
            if (audio_source) {
                audio_source.stop();
            }
        } else if (e.pageY > 409 && e.pageY < 509) {
            console.log('SOFTER');
            volume -= 10;
        }
    }


}

function update() {
    requestAnimationFrame(update);
    if(!audio_is_playing) {
        if (!canvas_is_cleared) {
            canvas_is_cleared = true;
            gfx.clearRect(0,0,canvas_width,canvas_height);
        }
        return;
    }

    var max_data_value = 0;

    gfx.clearRect(0,0,canvas_width,canvas_height);
    //gfx.fillStyle = 'black';
    //gfx.fillRect(0,0,canvas_width,canvas_height);

    var data = new Uint8Array(samples);
    fft.getByteFrequencyData(data);

    var colors = [
        '#00b6f0',
        '#3BEF71',
        '#F48422',
        '#F24FCF',
        '#FFEA32',
        '#00b6f0',
        '#3BEF71',
        '#F48422',
        '#F24FCF',
        '#FFEA32'
    ];

    gfx.fillStyle = '#00b6f0';

    var length = data.length / 2;
    var bar_width = Math.floor((canvas_width / length) / 3);
    var mid_point = Math.floor(canvas_width / 2);
    for(var i=0; i<length; i++) {
        var value = data[i];
        var top = canvas_height - Math.floor((canvas_height * (value * 1.0) / 256.0));
        var left1 = mid_point + i * bar_width;
        var left2 = mid_point - i * bar_width;
        var width = bar_width - 1;
        var height = canvas_height - top;

        top = Math.floor(top / 2);

        max_data_value = Math.max(max_data_value, value);

        if (colorsOn) {
            var div = data.length / colors.length;
            var colorIndex = Math.floor(i / div);
            gfx.fillStyle = colors[colorIndex];
        }
        gfx.fillRect(left1, top, bar_width-1, height);
        gfx.fillRect(left2, top, bar_width-1, height);
        canvas_is_cleared = false;
    }

    //console.log(max_data_value);
}
