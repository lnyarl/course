Func<bool, int> f = b => b ? 1 : 0;
Func<int, string> h = a => $"v{a + 10}";
var transformed = Lift(f, h);
Console.WriteLine($"{transformed(false)},{transformed(true)}");
var recovered = Lift(f, (int a) => a);
Console.WriteLine($"{recovered(false)},{recovered(true)}");
static Func<B, X> Lift<A, B, X>(Func<B, A> f, Func<A, X> h)
    => b => h(f(b));
