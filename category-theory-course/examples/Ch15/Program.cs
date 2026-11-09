int[] seed = [2, 4];
var encoded = new YonedaList<int>(seed);
Console.WriteLine(string.Join(",", encoded.Apply(x => x + 1)));
Console.WriteLine(string.Join(",", encoded.Apply(x => x)));
Console.WriteLine(string.Join(",", encoded.Apply(x => x.ToString())));
sealed class YonedaList<A>(IEnumerable<A> values)
{
    private readonly A[] data = values.ToArray();
    public B[] Apply<B>(Func<A, B> h) => data.Select(h).ToArray();
}
