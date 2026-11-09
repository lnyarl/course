Option<int> m = new Option<int>.Some(8);
Option<int> Half(int n) => n % 2 == 0
    ? new Option<int>.Some(n / 2)
    : new Option<int>.None();
var result = m.Bind(Half).Bind(Half);
Console.WriteLine(Show(result));
Console.WriteLine(Show(new Option<int>.Some(6).Bind(Half).Bind(Half)));
Console.WriteLine(Show(m.Bind(x => new Option<int>.Some(x))));
static string Show(Option<int> x) => x switch
{
    Option<int>.Some s => $"Some({s.Value})",
    _ => "None"
};
abstract record Option<A>
{
    public sealed record Some(A Value) : Option<A>;
    public sealed record None : Option<A>;
    public Option<B> Bind<B>(Func<A, Option<B>> f) => this switch
    {
        Some s => f(s.Value),
        _ => new Option<B>.None()
    };
}
