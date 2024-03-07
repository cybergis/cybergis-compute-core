import swaggerJsdoc = require("swagger-jsdoc");
import fs = require("fs");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CyberGIS Compute",
      version: "1.0.0",
    },
  },
  apis: ["./server.ts"], // files containing annotations as above
};

const output: object = swaggerJsdoc(options);
fs.writeFile(
  "./production/swagger.json",
  JSON.stringify(output),
  function (err) {
    if (err) {
      console.log("Writing failed");
    }
  }
);
