using System;
using System.Linq;
using System.Numerics;
static class Program
{
    static BigInteger Algebra(BigInteger[] xs) => xs.Aggregate(BigInteger.Zero, (a, b) => a + b);
    static void Main()
    {
        BigInteger[][] nested = [[1, 2], [], [3]];
        BigInteger left = Algebra(nested.SelectMany(xs => xs).ToArray());
        BigInteger right = Algebra(nested.Select(Algebra).ToArray());
        Console.WriteLine($"flatten then sum = {left}");
        Console.WriteLine($"sum then sum = {right}");
        Console.WriteLine($"unit(7) = {Algebra([7])}");
        Console.WriteLine($"length unit(7) = {new[] { 7 }.Length}");
    }
}
