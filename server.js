var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var port = 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', function (req, res) {
    console.log(req.body);
    res.json({ a: 1 });
});
app.listen(port, function () { return console.log("Example app listening at http://localhost:" + port); });
