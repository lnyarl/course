internal static class Program
{
    static void Main()
    {
        int[] events = [1, -2, 3];
        int imperative = 0;
        foreach (int x in events)
            if (x > 0)
                imperative += x * 2;
        int declarative = events.Where(x => x > 0).Select(x => x * 2).Sum();
        Console.WriteLine($"query = {declarative}");
        Console.WriteLine($"loop = {imperative}");
        int state = 0;
        var prefix = new List<int>();
        foreach (int x in events)
        {
            if (x > 0)
                state += x * 2;
            prefix.Add(state);
        }

        Console.WriteLine($"prefix states = {string.Join(",", prefix)}");
    }
}
