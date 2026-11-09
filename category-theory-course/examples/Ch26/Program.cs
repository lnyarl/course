using System;
using System.Linq;
int count = 0;
for (int a = 0; a < 4; a++)
    for (int b = 0; b < 4; b++)
    {
        int[] ta = [a / 2, a % 2], tb = [b / 2, b % 2];
        if (Enumerable.Range(0, 2).All(x => ta[x] == tb[0]))
            count++;
    }
Console.WriteLine($"natural families = {count}");
