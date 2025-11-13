#!/usr/bin/env node
/**
 * Interactive JavaScript program to test user input functionality
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🚀 Welcome to Interactive JavaScript!");
console.log("This program will ask for your input...");

// Function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  try {
    // Get user's name
    const name = await askQuestion("Enter your name: ");
    console.log(`Hello, ${name}! Nice to meet you.`);

    // Get user's age
    let age;
    while (true) {
      const ageInput = await askQuestion("Enter your age: ");
      age = parseInt(ageInput);
      if (!isNaN(age)) {
        break;
      }
      console.log("Please enter a valid number!");
    }

    // Calculate birth year
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    console.log(`You were probably born in ${birthYear}`);

    // Ask about favorite programming language
    const favLang = await askQuestion("What's your favorite programming language? ");
    console.log(`Great choice! ${favLang} is awesome.`);

    // Final summary
    console.log("\nSummary:");
    console.log(`- Name: ${name}`);
    console.log(`- Age: ${age}`);
    console.log(`- Birth Year: ${birthYear}`);
    console.log(`- Favorite Language: ${favLang}`);

    console.log("\n✅ Interactive program completed successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    rl.close();
  }
}

main();