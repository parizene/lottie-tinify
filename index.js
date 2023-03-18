const fs = require("fs");
const path = require("path");

require("dotenv").config();

if (!process.env.TINIFY_API_KEY) {
  throw new Error("No Tinify API key");
}

const tinify = require("tinify");
tinify.key = process.env.TINIFY_API_KEY;

const PNG_PREFIX = "data:image/png;base64,";

const escapeStringRegexp = (string) => {
  if (typeof string !== "string") {
    throw new TypeError("Expected a string");
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
};

const createDir = async (path) => {
  if (!fs.existsSync(path)) {
    await fs.promises.mkdir(path);
  }
};

const getFileSizeInKb = async (path) => {
  const stats = await fs.promises.stat(path);
  return (stats.size / 1024).toFixed(2);
};

const main = async () => {
  await createDir("input");
  await createDir("temp");
  await createDir("output");

  const files = await fs.promises.readdir("input");
  const filteredFiles = files.filter((file) => path.extname(file) === ".json");
  for (const jsonFile of filteredFiles) {
    const extension = path.extname(jsonFile);
    const basename = path.basename(jsonFile, extension);

    const inputFilePath = path.join("input", jsonFile);
    const outputFilePath = path.join("output", `${basename}_opt${extension}`);

    const tempDirPath = path.join("temp", basename);
    await createDir(tempDirPath);

    const jsonObj = JSON.parse(
      await fs.promises.readFile(inputFilePath, "utf-8")
    );

    for (const asset of jsonObj.assets) {
      if (asset.p && asset.p.startsWith(PNG_PREFIX)) {
        const imagePath = path.join(tempDirPath, `${asset.id}.png`);
        const imageOptimizedPath = path.join(
          tempDirPath,
          `${asset.id}_opt.png`
        );
        var pngBase64 = asset.p.replace(
          new RegExp(`^${escapeStringRegexp(PNG_PREFIX)}`),
          ""
        );
        await fs.promises.writeFile(imagePath, pngBase64, "base64");

        if (!fs.existsSync(imageOptimizedPath)) {
          const source = tinify.fromFile(imagePath);
          await source.toFile(imageOptimizedPath);
        }

        pngBase64 = await fs.promises.readFile(imageOptimizedPath, "base64");
        asset.p = PNG_PREFIX + pngBase64;
      }
    }

    await fs.promises.writeFile(outputFilePath, JSON.stringify(jsonObj));

    console.log(
      `${jsonFile}: ${await getFileSizeInKb(
        inputFilePath
      )} kB => ${await getFileSizeInKb(outputFilePath)} kB`
    );
  }
};

main();
