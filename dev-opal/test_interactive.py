#!/usr/bin/env python3
"""
Interactive Python program to test user input functionality
"""

print("🚀 Welcome to Interactive Python!")
print("This program will ask for your input...")

# Get user's name
name = input("Enter your name: ")
print(f"Hello, {name}! Nice to meet you.")

# Get user's age
while True:
    try:
        age = int(input("Enter your age: "))
        break
    except ValueError:
        print("Please enter a valid number!")

# Calculate birth year
from datetime import datetime
birth_year = datetime.now().year - age
print(f"You were probably born in {birth_year}")

# Ask a question
favorite_color = input("What's your favorite color? ")
print(f"Great choice! {favorite_color} is a beautiful color.")

# Final message
print(f"Summary:")
print(f"- Name: {name}")
print(f"- Age: {age}")
print(f"- Birth Year: {birth_year}")
print(f"- Favorite Color: {favorite_color}")

print("\n✅ Interactive program completed successfully!")