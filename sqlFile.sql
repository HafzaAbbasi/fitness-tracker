use oct;
CREATE DATABASE IF NOT EXISTS oct;
USE oct;
CREATE TABLE users (
    user_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- form

CREATE TABLE dietform (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    gender ENUM('Male','Female','Other') NOT NULL,
    age INT NOT NULL,
    workout_goal ENUM('Weight Loss','Muscle Building','Body Toning','Mental Health','Improve Fitness') NOT NULL,
    food_allergy VARCHAR(255),
    exercises TEXT NOT NULL,
    duration VARCHAR(50) NOT NULL,
    diet_plan TEXT NOT NULL
);

CREATE TABLE workout_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workout_goal ENUM('Weight Loss','Muscle Building','Body Toning','Mental Health','Improve Fitness') NOT NULL,
    exercises TEXT NOT NULL,
    duration VARCHAR(50) NOT NULL
);

INSERT INTO workout_suggestions (workout_goal, exercises, duration) VALUES
('Weight Loss', 'Running, Cycling, Jumping Jacks, Brisk Walking', '30-45 minutes'),
('Muscle Building', 'Weight Training (Squats, Deadlifts, Bench Press), Push-ups, Lunges', '45-60 minutes'),
('Body Toning', 'Cardio + Strength Training, Planks, Squats, Crunches', '40-50 minutes'),
('Mental Health', 'Yoga (Stretching, Meditation, Core Work), Light Walking', '30 minutes'),
('Improve Fitness', 'Cardio (Running, Cycling) + Recreational Sports, Jump Rope, Step-ups', '30-45 minutes');

CREATE TABLE diet_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workout_goal ENUM('Weight Loss','Muscle Building','Body Toning','Mental Health','Improve Fitness') NOT NULL,
    diet_plan TEXT NOT NULL
);

INSERT INTO diet_suggestions (workout_goal, diet_plan) VALUES
('Weight Loss', 'High carbs, protein shakes, bananas, oatmeal'),
('Muscle Building', 'High protein, eggs, chicken, nuts, milk'),
('Body Toning', 'Protein-rich, moderate carbs, low sugar'),
('Mental Health', 'Light meals, fruits, green tea, nuts'),
('Improve Fitness', 'Balanced diet with carbs for energy');

CREATE TABLE bmi_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  height FLOAT NOT NULL,
  weight FLOAT NOT NULL,
  bmi FLOAT NOT NULL,
  status VARCHAR(50) NOT NULL,
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);
-- Contact Us
CREATE TABLE contact_form (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
select * from users;
select * from contact_form;
select * from dietform;
select * from bmi_records;

SHOW TABLES;





