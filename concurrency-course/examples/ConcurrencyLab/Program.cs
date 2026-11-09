using ConcurrencyLab;

if (args.FirstOrDefault() == "--child")
{
    var child = new List<string>(args.Skip(1)) { "child" };
    Console.WriteLine($"자식 PID={Environment.ProcessId}, 리스트=[{string.Join(", ", child)}]");
    return;
}

switch (args.FirstOrDefault() ?? "help")
{
    case "01": Week01.Run(); break;
    case "02": await Week02.Run(); break;
    case "03": await Week03.Run(); break;
    case "04": Week04.Run(); break;
    case "05": await Week05.Run(); break;
    case "06": await Week06.Run(); break;
    case "07": await Week07.Run(); break;
    case "08": await Week08.Run(args.Skip(1).FirstOrDefault()); break;
    default:
        Console.WriteLine("실행: dotnet run --project ConcurrencyLab -- 01 (01~08)");
        Console.WriteLine("결과 파일 저장: dotnet run --project ConcurrencyLab -- 08 results.json");
        break;
}

internal static class Check
{
    public static void That(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
