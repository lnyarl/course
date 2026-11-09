using System.Numerics;

internal static class Program
{
    static Func<A, Func<B, C>> Curry<A, B, C>(Func<(A, B), C> f) => a => b => f((a, b));
    static Func<(A, B), C> Uncurry<A, B, C>(Func<A, Func<B, C>> f) => pair => f(pair.Item1)(pair.Item2);
    static void Main()
    {
        Func<(int, int), int> calculate = p => p.Item1 + 2 * p.Item2;
        var curried = Curry(calculate);
        Console.WriteLine($"curried(3)(4) = {curried(3)(4)}");
        var roundtrip = Uncurry(curried);
        bool same = Enumerable.Range(-2, 5).All(a => Enumerable.Range(-2, 5).All(b => roundtrip((a, b)) == calculate((a, b))));
        Console.WriteLine($"sample roundtrip = {same}");
        Console.WriteLine($"Bool -> Bool = {BigInteger.Pow(2, 2)}");
    }
}
