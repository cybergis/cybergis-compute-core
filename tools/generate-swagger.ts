import swaggerJSDoc from "swagger-jsdoc";

import * as fs from "fs";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CyberGIS Compute",
      version: "1.0.0",
    },
  },
  apis: ["./src/server/*"], // files containing annotations as above
};

const output: object = swaggerJSDoc(options);
fs.writeFile(
  "./production/swagger.json",
  JSON.stringify(output),
  function (err) {
    if (err) {
      console.log("Writing failed");
    }
  }
);
