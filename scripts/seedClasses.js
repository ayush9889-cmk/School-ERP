require("dotenv").config();
const connectDB = require("../src/config/db");
const Class = require("../src/models/Class");

const names = [
  "Nursery",
  "LKG",
  "UKG",
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
];

(async () => {
  await connectDB();

  for (const name of names) {
    const exists = await Class.findOne({ name });
    if (!exists) {
      await Class.create({ name, sections: ["A", "B"] });
      console.log(`Created class ${name}`);
    }
  }

  console.log("Done");
  process.exit(0);
})();
