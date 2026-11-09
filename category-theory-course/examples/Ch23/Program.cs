var store = new Store<int,int>(i => i*i, 2);
Console.WriteLine($"extract={store.Extract()}");
var sums = store.Extend(w => w.Peek(w.Position-1)
    + w.Extract() + w.Peek(w.Position+1));
Console.WriteLine($"localSum={sums.Extract()}");
var firstLaw = store.Duplicate().Extract();
var secondLaw = store.Duplicate().Map(w => w.Extract());
Console.WriteLine($"focus={firstLaw.Position},{secondLaw.Position}");
Console.WriteLine($"peek3={firstLaw.Peek(3)},{secondLaw.Peek(3)}");
sealed record Store<S,A>(Func<S,A> Peek, S Position)
{
    public A Extract() => Peek(Position);
    public Store<S,B> Map<B>(Func<A,B> f)
    {
        var peek = Peek;
        return new(s => f(peek(s)), Position);
    }
    public Store<S,Store<S,A>> Duplicate()
    {
        var peek = Peek;
        return new(s => new Store<S,A>(peek,s), Position);
    }
    public Store<S,B> Extend<B>(Func<Store<S,A>,B> f)
        => Duplicate().Map(f);
}
