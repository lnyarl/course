abstract class Either<A, B>
{
    private Either()
    {
    }

    public abstract R Match<R>(Func<A, R> l, Func<B, R> r);
    public sealed class Left(A value) : Either<A, B>
    {
        public override R Match<R>(Func<A, R> l, Func<B, R> r) => l(value);
    }

    public sealed class Right(B value) : Either<A, B>
    {
        public override R Match<R>(Func<A, R> l, Func<B, R> r) => r(value);
    }
}

readonly record struct Unit;
internal static class Program
{
    static Either<(A, B), (A, C)> Spread<A, B, C>((A, Either<B, C>) x) => x.Item2.Match<Either<(A, B), (A, C)>>(b => new Either<(A, B), (A, C)>.Left((x.Item1, b)), c => new Either<(A, B), (A, C)>.Right((x.Item1, c)));
    static (A, Either<B, C>) Collect<A, B, C>(Either<(A, B), (A, C)> x) => x.Match<(A, Either<B, C>)>(p => (p.Item1, new Either<B, C>.Left(p.Item2)), p => (p.Item1, new Either<B, C>.Right(p.Item2)));
    static string Signature((bool, Either<bool, Unit>) p) => p.Item1 + ":" + p.Item2.Match(b => "L" + b, _ => "R");
    static void Main()
    {
        var values = new List<(bool, Either<bool, Unit>)>();
        foreach (bool a in new[]
        {
            false,
            true
        }

        )
        {
            foreach (bool b in new[]
            {
                false,
                true
            }

            )
                values.Add((a, new Either<bool, Unit>.Left(b)));
            values.Add((a, new Either<bool, Unit>.Right(new Unit())));
        }

        Console.WriteLine($"states = {values.Count}");
        Console.WriteLine($"roundtrip = {values.All(x => Signature(Collect(Spread(x))) == Signature(x))}");
    }
}
