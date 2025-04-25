import express from "express";
import fileUpload from "express-fileupload";

const app = express();

app.enable("trust proxy");

// MIDDLEWARE SETUP — NO express.json(), NO urlencoded
app.use(fileUpload());

app.post("/test-upload", (req, res) => {
  console.log("HEADERS:", req.headers);

  if (!req.files) {
    return res.status(400).send("No files object at all");
  }

  console.log("FILES:", req.files);

  const file = req.files.file || req.files.files;
  if (!file) {
    return res.status(400).send("No file uploaded");
  }
});

app.get("/ip", (req, res) => {
  console.log(req.ip);
  console.log("req.ip:", req.ip);
  console.log(req.headers["x-real-ip"]);
  console.log(req.headers["x-forwarded-for"]);
  console.log(req.header("x-forwarded-for"));
  console.log(req.headers);
  console.log("RemoteAddr:", req.socket.remoteAddress);

  return res.status(200).send("cool");
});


app.listen(3030, "0.0.0.0");