export interface CompilerLanguage {
  name: string;
  extension: string;
  hasCompileStep: boolean;
}

export interface CompilationResult {
  success: boolean;
  stage: 'compilation' | 'execution';
  stdout?: string;
  stderr?: string;
  error?: string;
  exitCode?: number;
  sessionId?: string;
  executionTime?: number;
  message?: string;
  outputFile?: string;
  timeout?: boolean;
}

export interface CompilerInfo {
  success: boolean;
  language: string;
  versionInfo: string;
  config: {
    extension: string;
    compile: string | null;
    run: string;
    timeout: number;
  };
}

export interface CompileRequest {
  language: string;
  code: string;
  filename?: string;
  options?: {
    timeout?: number;
    compileTimeout?: number;
    runTimeout?: number;
  };
}

export interface RunRequest extends CompileRequest {
  input?: string;
}

class CompilerService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'http://localhost:3002';
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Compiler service health check failed:', error);
      return false;
    }
  }

  async getSupportedLanguages(): Promise<CompilerLanguage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/languages`);
      const data = await response.json();
      
      if (data.success) {
        return data.languages;
      } else {
        throw new Error(data.error || 'Failed to fetch supported languages');
      }
    } catch (error) {
      console.error('Error fetching supported languages:', error);
      throw error;
    }
  }

  async compileCode(request: CompileRequest): Promise<CompilationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Compilation error:', error);
      return {
        success: false,
        stage: 'compilation',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  async runCode(request: RunRequest): Promise<CompilationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Execution error:', error);
      return {
        success: false,
        stage: 'execution',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  async getCompilerInfo(language: string): Promise<CompilerInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/info/${language}`);
      const result = await response.json();
      
      if (result.success) {
        return result;
      } else {
        throw new Error(result.error || 'Failed to fetch compiler info');
      }
    } catch (error) {
      console.error('Error fetching compiler info:', error);
      throw error;
    }
  }

  // Helper method to determine language from file extension
  getLanguageFromExtension(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const extensionMap: Record<string, string> = {
      'js': 'javascript',
      'mjs': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'dart': 'dart',
      'hs': 'haskell',
      'scala': 'scala',
      'lua': 'lua',
      'pl': 'perl',
      'r': 'r',
      'R': 'r',
      'jl': 'julia',
      'asm': 'assembly',
      'f90': 'fortran',
      'f95': 'fortran',
      'cob': 'cobol'
    };

    return ext ? extensionMap[ext] || null : null;
  }

  // Helper method to get file extension from language
  getExtensionFromLanguage(language: string): string {
    const languageMap: Record<string, string> = {
      'javascript': '.js',
      'typescript': '.ts',
      'python': '.py',
      'java': '.java',
      'cpp': '.cpp',
      'c': '.c',
      'go': '.go',
      'rust': '.rs',
      'csharp': '.cs',
      'php': '.php',
      'ruby': '.rb',
      'swift': '.swift',
      'kotlin': '.kt',
      'dart': '.dart',
      'haskell': '.hs',
      'scala': '.scala',
      'lua': '.lua',
      'perl': '.pl',
      'r': '.R',
      'julia': '.jl',
      'assembly': '.asm',
      'fortran': '.f90',
      'cobol': '.cob'
    };

    return languageMap[language] || '.txt';
  }

  // Helper method to get sample code for a language
  getSampleCode(language: string): string {
    const samples: Record<string, string> = {
      javascript: `console.log("Hello, World!");

// Example: Simple function
function greet(name) {
    return \`Hello, \${name}!\`;
}

console.log(greet("JavaScript"));`,

      typescript: `console.log("Hello, TypeScript!");

// Example: Typed function
function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

interface Person {
    name: string;
    age: number;
}

const person: Person = { name: "TypeScript", age: 12 };
console.log(greet(person.name));`,

      python: `print("Hello, World!")

# Example: Simple function
def greet(name):
    return f"Hello, {name}!"

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(greet("Python"))
print(f"Fibonacci(10): {fibonacci(10)}")`,

      java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Example: Simple method
        System.out.println(greet("Java"));
        System.out.println("Fibonacci(10): " + fibonacci(10));
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
    
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}`,

      cpp: `#include <iostream>
#include <string>

using namespace std;

string greet(const string& name) {
    return "Hello, " + name + "!";
}

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Hello, World!" << endl;
    cout << greet("C++") << endl;
    cout << "Fibonacci(10): " << fibonacci(10) << endl;
    return 0;
}`,

      c: `#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    printf("Hello, World!\\n");
    printf("Hello, C!\\n");
    printf("Fibonacci(10): %d\\n", fibonacci(10));
    return 0;
}`,

      go: `package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    fmt.Println("Hello, World!")
    fmt.Println(greet("Go"))
    fmt.Printf("Fibonacci(10): %d\\n", fibonacci(10))
}`,

      rust: `fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn fibonacci(n: u32) -> u32 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    println!("Hello, World!");
    println!("{}", greet("Rust"));
    println!("Fibonacci(10): {}", fibonacci(10));
}`,

      php: `<?php

function greet($name) {
    return "Hello, " . $name . "!";
}

function fibonacci($n) {
    if ($n <= 1) return $n;
    return fibonacci($n - 1) + fibonacci($n - 2);
}

echo "Hello, World!\\n";
echo greet("PHP") . "\\n";
echo "Fibonacci(10): " . fibonacci(10) . "\\n";

?>`,

      ruby: `def greet(name)
    "Hello, \#{name}!"
end

def fibonacci(n)
    return n if n <= 1
    fibonacci(n - 1) + fibonacci(n - 2)
end

puts "Hello, World!"
puts greet("Ruby")
puts "Fibonacci(10): \#{fibonacci(10)}"`,

      python: `print("Hello, World!")

def greet(name):
    return f"Hello, {name}!"

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(greet("Python"))
print(f"Fibonacci(10): {fibonacci(10)}")`
    };

    return samples[language] || `// Sample ${language} code
print("Hello, World!");`;
  }
}

export const compilerService = new CompilerService();