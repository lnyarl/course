using System;
using System.Numerics;

readonly record struct Writer<T>(T Value, string Log);

internal static class Program
{
    static Writer<T> Identity<T>(T value) => new(value, "");

    // g 다음 f가 아니라 f 다음 g이다: Compose(g, f).
    static Func<A, Writer<C>> Compose<A, B, C>(
        Func<B, Writer<C>> g, Func<A, Writer<B>> f)
        => input =>
        {
            var first = f(input);
            var second = g(first.Value);
            return new Writer<C>(second.Value, first.Log + second.Log);
        };

    static void Main()
    {
        Func<BigInteger, Writer<BigInteger>> f = x => new(x + 1, "f>");
        Func<BigInteger, Writer<BigInteger>> g = x => new(x * 2, "g>");
        Func<BigInteger, Writer<BigInteger>> h = x => new(x * x, "h>");
        var composed = Compose(h, Compose(g, f))(2);
        var first = f(2);
        var second = g(first.Value);
        var third = h(second.Value);
        var manual = new Writer<BigInteger>(
            third.Value, first.Log + second.Log + third.Log);
        Console.WriteLine($"value = {composed.Value}");
        Console.WriteLine($"log = {composed.Log}");
        Console.WriteLine($"manual equals composed = {manual == composed}");

        var otherGrouping = Compose(Compose(h, g), f)(2);
        Console.WriteLine($"associativity value = {composed.Value == otherGrouping.Value}");
        Console.WriteLine($"associativity log = {composed.Log == otherGrouping.Log}");
        Func<BigInteger, Writer<BigInteger>> id = Identity<BigInteger>;
        Console.WriteLine($"identity before = {Compose(f, id)(2) == f(2)}");
        Console.WriteLine($"identity after = {Compose(id, f)(2) == f(2)}");

        Func<int, Writer<bool>> isEven = n => new(n % 2 == 0, "isEven>");
        Func<bool, Writer<bool>> negate = b => new(!b, "negate>");
        var isOdd = Compose<int, bool, bool>(negate, isEven)(3);
        Console.WriteLine($"isOdd(3) = {isOdd.Value}");
        Console.WriteLine($"isOdd log = {isOdd.Log}");
    }
}
