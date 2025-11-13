
def fibonacci(n):
    fib_list = []
    a, b = 0, 1
    while len(fib_list) < n:
        fib_list.append(a)
        a, b = b, a + b
    return fib_list

if __name__ == "__main__":
    num_fibs = 10
    fib_numbers = fibonacci(num_fibs)
    print(f"The first {num_fibs} Fibonacci numbers are: {fib_numbers}")
