using System;
using System.Linq;
using System.Numerics;

internal static class Program
{
    static T Identity<T>(T value) => value;

    // Compose(g, f)는 f를 먼저 실행하고 g를 실행한다.
    static Func<A, C> Compose<A, B, C>(
        Func<B, C> g, Func<A, B> f)
        => x => g(f(x));

    static bool SameOn<A, B>(
        Func<A, B> left, Func<A, B> right, A[] samples)
        => samples.All(x =>
            System.Collections.Generic.EqualityComparer<B>
                .Default.Equals(left(x), right(x)));

    static void Main()
    {
        Func<string, int> length = text => text.Length;
        Func<int, bool> isEven = n => n % 2 == 0;
        var evenLength = Compose<string, int, bool>(isEven, length);
        Console.WriteLine($"evenLength(code) = {evenLength("code")}");

        Func<BigInteger, BigInteger> f = x => x + 1;
        Func<BigInteger, BigInteger> g = x => x * 2;
        Func<BigInteger, BigInteger> h = x => x * x;
        var left = Compose(h, Compose(g, f));
        var right = Compose(Compose(h, g), f);
        BigInteger[] samples = [-2, -1, 0, 1, 2];
        Console.WriteLine($"left(2) = {left(2)}");
        Console.WriteLine($"right(2) = {right(2)}");
        Console.WriteLine($"associative on samples = {SameOn(left, right, samples)}");

        Func<string, string> idString = Identity<string>;
        Func<int, int> idInt = Identity<int>;
        string[] words = ["", "a", "code"];
        var before = Compose<string, string, int>(length, idString);
        var after = Compose<string, int, int>(idInt, length);
        Console.WriteLine($"identity before = {SameOn(before, length, words)}");
        Console.WriteLine($"identity after = {SameOn(after, length, words)}");

        Func<bool, bool> not = value => !value;
        Func<bool, bool> idBool = Identity<bool>;
        var twice = Compose<bool, bool, bool>(not, not);
        Console.WriteLine($"not twice = {SameOn(twice, idBool, [false, true])}");
    }
}
