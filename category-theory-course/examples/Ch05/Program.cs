using System;

readonly record struct Unit;

abstract class Either<A, B>
{
    private Either() { }
    public abstract R Match<R>(Func<A, R> left, Func<B, R> right);

    public sealed class Left : Either<A, B>
    {
        readonly A value;
        public Left(A value) { this.value = value; }
        public override R Match<R>(Func<A, R> left, Func<B, R> right)
            => left(value);
    }
    public sealed class Right : Either<A, B>
    {
        readonly B value;
        public Right(B value) { this.value = value; }
        public override R Match<R>(Func<A, R> left, Func<B, R> right)
            => right(value);
    }
}

internal static class Program
{
    static Func<X, (A, B)> Fanout<X, A, B>(Func<X, A> f, Func<X, B> g)
        => x => (f(x), g(x));
    static A First<A, B>((A, B) pair) => pair.Item1;
    static B Second<A, B>((A, B) pair) => pair.Item2;
    static (B, A) Swap<A, B>((A, B) pair) => (pair.Item2, pair.Item1);
    static Func<Either<A, B>, C> Cases<A, B, C>(Func<A, C> f, Func<B, C> g)
        => value => value.Match(f, g);

    static void Main()
    {
        Func<int, int> f = x => x + 1;
        Func<int, bool> g = x => x % 2 == 0;
        // 이 예제의 입력 범위에서 고정 폭 정수 오버플로는 없다.
        var pair = Fanout(f, g)(3);
        Console.WriteLine($"product(3) = ({pair.Item1},{pair.Item2})");
        Console.WriteLine($"projection A = {First(pair)}");
        Console.WriteLine($"projection B = {Second(pair)}");
        Console.WriteLine($"swap twice = {Swap(Swap(pair)) == pair}");

        var dispatch = Cases<int, int, string>(n => $"L:{n}", n => $"R:{n}");
        Either<int, int> left = new Either<int, int>.Left(0);
        Either<int, int> right = new Either<int, int>.Right(0);
        Console.WriteLine($"left(0) = {dispatch(left)}");
        Console.WriteLine($"right(0) = {dispatch(right)}");

        Func<int, Unit> discard = _ => new Unit();
        Console.WriteLine($"unit equal = {discard(3) == discard(99)}");
    }
}
