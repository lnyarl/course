Func<int, int> reader = env => (env + 3) * env;
Console.WriteLine($"reader={reader(2)}");
var writer = (Value: (2 + 3) * 2, Log: "add;" + "double;");
Console.WriteLine($"writer={writer.Value}:{writer.Log}");
Func<int, (int Value, int State)> fresh = s => (s, s + 1);
var program = Bind(fresh, a => Bind(fresh, b => Pure(a + b)));
var result = program(10);
Console.WriteLine($"state={result.Value},{result.State}");
static Func<int, (A Value, int State)> Pure<A>(A a) => s => (a, s);
static Func<int, (B Value, int State)> Bind<A,B>(
    Func<int, (A Value, int State)> m,
    Func<A, Func<int, (B Value, int State)>> f)
    => s =>
    {
        var (a, next) = m(s);
        return f(a)(next);
    };
