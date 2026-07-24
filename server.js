require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const path = require("path");
const session = require("express-session");

const app = express();
app.set('trust proxy', 1);

const SPOON_KEY = process.env.SPOON_KEY;

// =================== MIDDLEWARE ===================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve HTML files

app.get("/", (req, res) => {
  res.redirect("/register.html");
});

// ✅ Session setup (in-memory, fine on Bonto's always-on server)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true
  }
}));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
// =================== MYSQL CONNECTION ===================
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
    return; // don't kill the process
  }
  console.log("✅ Connected to MySQL");
  console.log("👉 Open in browser: http://localhost:3000/register.html");
  connection.release();
});

// =================== SIGNUP ===================
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "All fields are required!" });

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
      if (err) return res.status(500).json({ success: false, message: " Database error" });
      if (result.length > 0)
        return res.status(400).json({ success: false, message: " User already exists! Please login." });

      db.query("SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1", async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: " Error fetching last ID" });

        let newId = "ft01";
        if (result.length > 0) {
          const lastId = result[0].user_id;
          const num = parseInt(lastId.slice(2)) + 1;
          newId = "ft" + num.toString().padStart(2, "0");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(
          "INSERT INTO users (user_id, name, email, password) VALUES (?, ?, ?, ?)",
          [newId, name, email, hashedPassword],
          (err) => {
            if (err)
              return res.status(500).json({ success: false, message: " Error inserting user" });

            req.session.email = email;

            return res.json({
              success: true,
              message: " Registration successful!",
              userId: newId,
              email
            });
          }
        );
      });
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: " Server error" });
  }
});

// =================== LOGIN ===================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email & password required!" });
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
      if (err) return res.status(500).json({ success: false, message: " Database error" });
      if (result.length === 0)
        return res.status(404).json({ success: false, message: " User not found. Please sign up." });
      const user = result[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.email = email;

        return res.json({
          success: true,
          message: "🔑 Login successful! Welcome back " + user.name,
          userId: user.user_id,
          email
        });
      } else {
        return res.status(401).json({ success: false, message: " Wrong password" });
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: " Server error" });
  }
});

// =================== CHECK DIET PLAN ===================
app.get("/checkDiet", async (req, res) => {
  if (!req.session.email) return res.json({ exists: false });

  try {
    const [plan] = await db.promise().query(
      "SELECT * FROM dietform WHERE email = ?",
      [req.session.email]
    );

    if (plan.length > 0) {
      res.json({ exists: true, dietPlan: plan[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("❌ Error checking diet plan:", err);
    res.json({ exists: false });
  }
});

// =================== CONTACT FORM ===================
app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).send("⚠️ All fields are required!");

  const sql = "INSERT INTO contact_form (name, email, message) VALUES (?, ?, ?)";
  db.query(sql, [name, email, message], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("❌ Error saving message");
    }
    res.send("✅ Message sent successfully!");
  });
});

// =================== GET PLAN ===================
app.post("/getPlan", async (req, res) => {
  const email = req.session.email;
  const { name, gender, age, workout_goal, food_allergy } = req.body;
  if (!email) {
    return res.json({ success: false, message: "User not logged in" });
  }
  try {
    const [workoutResults] = await db.promise().query(
      "SELECT exercises, duration FROM workout_suggestions WHERE workout_goal = ?",
      [workout_goal]
    );
    if (!workoutResults.length) {
      return res.json({ success: false, message: " Workout not found" });
    }
    const exercises = workoutResults[0].exercises;
    const duration = workoutResults[0].duration;
    const apiURL = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&exclude=${food_allergy || ""}&apiKey=${SPOON_KEY}`;
    const response = await fetch(apiURL);
    const apiData = await response.json();
    let diet_plan = apiData.meals
      ? apiData.meals.map(m => m.title).join(", ")
      : "No meal plan found";
    const replacements = { nuts: "chia seeds", almonds: "sunflower seeds", milk: "soy milk", egg: "tofu" };
    let replaceMessage = "";
    if (food_allergy && replacements[food_allergy.toLowerCase()]) {
      replaceMessage = `${food_allergy} were replaced with ${replacements[food_allergy.toLowerCase()]}.`;
    } else if (food_allergy) {
      replaceMessage = `Your meal plan excludes ${food_allergy}.`;
    } else {
      replaceMessage = "No food allergies mentioned.";
    }
    const [existingPlan] = await db.promise().query(
      "SELECT * FROM dietform WHERE email = ?",
      [email]
    );

    let messageText = existingPlan.length
      ? "✅ Plan updated successfully!"
      : "🎉 Your plan has been created!";

    const upsertQuery = `
      INSERT INTO dietform 
      (name, email, gender, age, workout_goal, food_allergy, exercises, duration, diet_plan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        gender = VALUES(gender),
        age = VALUES(age),
        workout_goal = VALUES(workout_goal),
        food_allergy = VALUES(food_allergy),
        exercises = VALUES(exercises),
        duration = VALUES(duration),
        diet_plan = VALUES(diet_plan)
    `;
    await db.promise().query(upsertQuery, [
      name, email, gender, age, workout_goal, food_allergy, exercises, duration, diet_plan
    ]);
    res.json({
      success: true,
      workout_goal,
      exercises,
      duration,
      diet_plan,
      message: messageText,
      replaceMessage
    });
  } catch (err) {
    console.error(" Error:", err);
    res.json({ success: false, message: " Failed to fetch plan" });
  }
});

// =================== GET PLAN AGAIN ===================
app.post("/getPlanAgain", async (req, res) => {
  const email = req.session.email;
  if (!email) return res.json({ success: false, message: "User not logged in" });
  const { workout_goal } = req.body;
  try {
    const [workoutResults] = await db.promise().query(
      "SELECT exercises, duration FROM workout_suggestions WHERE workout_goal = ?",
      [workout_goal]
    );
    const exercises = workoutResults[0].exercises;
    const duration = workoutResults[0].duration;
    const response = await fetch(`https://api.spoonacular.com/mealplanner/generate?timeFrame=day&apiKey=${SPOON_KEY}`);
    const apiData = await response.json();
    const diet_plan = apiData.meals
      ? apiData.meals.map(m => m.title).join(", ")
      : "No meal plan found";
    await db.promise().query(`
      UPDATE dietform SET 
        workout_goal = ?, exercises = ?, duration = ?, diet_plan = ?
      WHERE email = ?
    `, [workout_goal, exercises, duration, diet_plan, email]);
    res.json({
      success: true,
      workout_goal,
      exercises,
      duration,
      diet_plan,
      message: "New plan generated!"
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error updating plan" });
  }
});

// =================== BMI CALCULATOR ===================
app.post("/calculateBMI", (req, res) => {
  let { email, height, weight } = req.body;
  email = email.trim().toLowerCase();
  if (!email || !height || !weight)
    return res.json({ success: false, message: "All fields are required!" });

  if (typeof height === "string") {
    const match = height.trim().match(/^(\d+)'(\d+)?("?)/);
    if (match) {
      const feet = parseInt(match[1]);
      const inches = parseInt(match[2] || 0);
      const totalInches = feet * 12 + inches;
      height = totalInches * 0.0254;
    } else {
      height = parseFloat(height);
      if (isNaN(height) || height <= 0)
        return res.json({ success: false, message: "❌ Invalid height format!" });
    }
  }

  const bmi = weight / (height * height);
  let status;
  if (bmi < 18.5) status = "Underweight";
  else if (bmi < 25) status = "Normal weight";
  else if (bmi < 30) status = "Overweight";
  else status = "Obese";

  const query = `
    INSERT INTO bmi_records (email, height, weight, bmi, status)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      height = VALUES(height),
      weight = VALUES(weight),
      bmi = VALUES(bmi),
      status = VALUES(status)
  `;

  db.query(query, [email, height, weight, bmi, status], (err) => {
    if (err) {
      console.error("BMI DB Error:", err);
      return res.json({ success: false, message: "Database error saving BMI record." });
    }
    res.json({ success: true, bmi, status });
  });
});

// =================== 404 HANDLER ===================
app.use((req, res) => {
  res.status(404).json({ message: "❌ Route not found" });
});

// =================== SERVER START ===================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));