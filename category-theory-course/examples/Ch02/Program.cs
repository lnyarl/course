using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;

readonly record struct Unit;

internal static class Program
{
    // 단일 스레드, 기본 키 동등성, 정상 반환 결과만 캐시한다.
    static Func<A, B> Memoize<A, B>(Func<A, B> function)
        where A : notnull
    {
        var cache = new Dictionary<A, B>();
        return input =>
        {
            if (cache.TryGetValue(input, out var result)) return result;
            result = function(input);
            cache.Add(input, result);
            return result;
        };
    }

    static void Main()
    {
        Func<Unit, int> choose = _ => 44;
        Func<int, Unit> discard = _ => new Unit();
        Console.WriteLine($"unit equal = {discard(7) == discard(99)}");
        Console.WriteLine($"unit chooses = {choose(new Unit())}");

        Console.WriteLine($"Bool -> Bool = {BigInteger.Pow(2, 2)}");
        Console.WriteLine($"Empty -> Bool = {BigInteger.Pow(2, 0)}");
        Console.WriteLine($"Bool -> Empty = {BigInteger.Pow(0, 2)}");
        Console.WriteLine($"Empty -> Empty = {BigInteger.Pow(0, 0)}");

        BigInteger[] inputs = [2, 2, 3];
        Func<BigInteger, BigInteger> square = n => n * n;
        var memoSquare = Memoize(square);
        Console.WriteLine($"square direct = {string.Join(",", inputs.Select(square))}");
        Console.WriteLine($"square memo = {string.Join(",", inputs.Select(memoSquare))}");

        // 서로 독립적인 초기 상태로 비교한다.
        BigInteger directState = 0, memoState = 0;
        Func<BigInteger, BigInteger> counter = n => directState += n;
        var memoCounter = Memoize<BigInteger, BigInteger>(n => memoState += n);
        Console.WriteLine($"counter direct = {string.Join(",", inputs.Select(counter))}");
        Console.WriteLine($"counter memo = {string.Join(",", inputs.Select(memoCounter))}");
    }
}
