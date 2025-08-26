#!/usr/bin/env python3
"""
Test program to demonstrate interactive input handling in VelocIDE
"""

print("🎯 Interactive Input Test Program")
print("=" * 40)

# Test 1: Simple input
name = input("What's your name? ")
print(f"Hello, {name}! 👋")

# Test 2: Number input
try:
    age = int(input("How old are you? "))
    print(f"Wow, {age} years old! 🎂")
except ValueError:
    print("That's not a valid number! 😅")

# Test 3: Multiple inputs
print("\n📝 Let's do some math:")
try:
    num1 = float(input("Enter first number: "))
    num2 = float(input("Enter second number: "))
    result = num1 + num2
    print(f"✨ {num1} + {num2} = {result}")
except ValueError:
    print("Please enter valid numbers! 🔢")

# Test 4: Choice selection
print("\n🎮 Choose your adventure:")
print("1. Go left 👈")
print("2. Go right 👉")
print("3. Go straight 👆")

choice = input("Enter your choice (1-3): ")
if choice == "1":
    print("🏔️ You found a mountain!")
elif choice == "2":
    print("🌊 You found an ocean!")
elif choice == "3":
    print("🏰 You found a castle!")
else:
    print("❓ Unknown choice! You got lost...")

print("\n🎉 Thanks for testing the interactive input system!")
print("✅ Test completed successfully!")