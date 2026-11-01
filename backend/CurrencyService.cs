using System.Collections.Concurrent;
using System.Text.Json;
namespace StockFlow;

public record CurrencyQuote(string BaseCurrency, string TargetCurrency, decimal Amount, decimal Rate, decimal Converted, string RateDate, bool IsFallback, string Message);
public class CurrencyService(HttpClient http, IConfiguration config)
{
    static readonly ConcurrentDictionary<string, (decimal rate, string date, DateTime fetched)> Cache = new();
    public static readonly string[] Supported = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD"];
    public async Task<CurrencyQuote> Quote(string currency, decimal amount)
    {
        currency = currency.ToUpperInvariant();
        if (!Supported.Contains(currency) || amount < 0 || amount > 99999999) throw new RuleException(400, "Choose a supported currency and an amount between 0 and 99,999,999.");
        try
        {
            if (config.GetValue<bool>("Fx:Offline")) throw new HttpRequestException();
            using var response = await http.GetAsync($"latest?base={currency}&symbols=PHP"); response.EnsureSuccessStatusCode();
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()); var root = json.RootElement;
            var rate = root.GetProperty("rates").GetProperty("PHP").GetDecimal(); var date = root.GetProperty("date").GetString()!;
            if (rate <= 0 || !DateOnly.TryParse(date, out var day) || day > DateOnly.FromDateTime(DateTime.UtcNow) || day < DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10))) throw new JsonException();
            Cache[currency] = (rate, date, DateTime.UtcNow); return new(currency, "PHP", amount, rate, decimal.Round(amount * rate, 2), date, false, "Frankfurter reference rate. Estimates may differ from your bank’s rate.");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or FormatException or InvalidOperationException)
        {
            if (Cache.TryGetValue(currency, out var old) && DateTime.UtcNow - old.fetched < TimeSpan.FromDays(7)) return new(currency, "PHP", amount, old.rate, decimal.Round(amount * old.rate, 2), old.date, true, "Live rates are unavailable. This estimate uses a previously retrieved rate; check the date before making a purchase.");
            throw new RuleException(503, "Exchange rates are temporarily unavailable and no recent saved rate exists. Your inventory and orders still work. Please try again later.");
        }
    }
}
