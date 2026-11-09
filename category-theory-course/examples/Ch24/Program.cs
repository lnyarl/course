using System;
abstract record Nat;
sealed record Zero : Nat;
sealed record Succ(Nat Previous) : Nat;
static class Program
{
    static A Fold<A>(Nat n, A zero, Func<A, A> succ) => n switch
    {
        Zero => zero,
        Succ s => succ(Fold(s.Previous, zero, succ)),
        _ => throw new ArgumentException("unknown constructor")
    };
    static void Main()
    {
        Nat three = new Succ(new Succ(new Succ(new Zero())));
        Console.WriteLine($"value = {Fold(three, 0, x => x + 1)}");
        Console.WriteLine($"stars = {Fold(three, "", x => "*" + x)}");
    }
}
