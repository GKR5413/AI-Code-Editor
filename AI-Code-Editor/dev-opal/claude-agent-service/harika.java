// harika.java - String Traversal Examples

public class harika {

    public static void main(String[] args) {
        String myString = "Hello, World!";

        // 1. Character-by-character traversal using a for loop and charAt()
        System.out.println("Character-by-character traversal (charAt()):");
        for (int i = 0; i < myString.length(); i++) {
            char currentChar = myString.charAt(i);
            System.out.println("Character at index " + i + ": " + currentChar);
        }

        System.out.println("\n--------------------\n");

        // 2. Character-by-character traversal using toCharArray()
        System.out.println("Character-by-character traversal (toCharArray()):");
        char[] charArray = myString.toCharArray();
        for (char c : charArray) {
            System.out.println("Character: " + c);
        }

        System.out.println("\n--------------------\n");

        // 3. Traversing with String.substring() (Less efficient for character-by-character)
        System.out.println("Traversal using substring():");
        for (int i = 0; i < myString.length(); i++) {
            String singleChar = myString.substring(i, i + 1); // from i (inclusive) to i+1 (exclusive)
            System.out.println("Character at index " + i + ": " + singleChar);
        }

        System.out.println("\n--------------------\n");

        // 4. Using code points (Handles Unicode characters correctly, including those outside the BMP)
        System.out.println("Traversal using code points:");
        for (int i = 0; i < myString.codePointCount(0, myString.length()); i++) {
            int codePoint = myString.codePointAt(myString.offsetByCodePoints(0, i));
            System.out.println("Code point at index " + i + ": " + codePoint + " (Character: " + Character.toString(codePoint) + ")");
        }

        System.out.println("\n--------------------\n");

        // Example: Finding a specific character
        char searchChar = 'o';
        System.out.println("Searching for the character: " + searchChar);
        for (int i = 0; i < myString.length(); i++) {
            if (myString.charAt(i) == searchChar) {
                System.out.println("Found '" + searchChar + "' at index: " + i);
            }
        }
    }
}
