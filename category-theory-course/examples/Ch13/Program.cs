using System.Numerics;

internal static class Program
{
    static BigInteger FoldMap<T>(IEnumerable<T> word, Func<T, BigInteger> q, Func<BigInteger, BigInteger, BigInteger> append, BigInteger unit)
    {
        var result = unit;
        foreach (var x in word)
            result = append(result, q(x));
        return result;
    }

    static void Main()
    {
        Func<char, BigInteger> q = c => c == 'a' ? 2 : 3;
        Func<BigInteger, BigInteger, BigInteger> multiply = (a, b) => a * b, add = (a, b) => a + b;
        Console.WriteLine($"product(aba) = {FoldMap("aba", q, multiply, 1)}");
        Console.WriteLine($"sum(aba) = {FoldMap("aba", q, add, 0)}");
        Console.WriteLine($"empty product = {FoldMap("", q, multiply, 1)}");
        string u = "ab", v = "ba";
        Console.WriteLine($"homomorphism = {FoldMap(u + v, q, multiply, 1) == FoldMap(u, q, multiply, 1) * FoldMap(v, q, multiply, 1)}");
    }
}
