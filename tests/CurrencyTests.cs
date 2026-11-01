using System.Net;
using Microsoft.Extensions.Configuration;
using StockFlow;
using Xunit;
public class CurrencyTests {
 class Handler(Func<HttpResponseMessage> respond):HttpMessageHandler {protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token)=>Task.FromResult(respond());}
 static CurrencyService Service(Func<HttpResponseMessage> respond)=>new(new HttpClient(new Handler(respond)){BaseAddress=new Uri("https://api.frankfurter.dev/v1/")},new ConfigurationBuilder().Build());
 [Fact] public async Task Live_rate_then_outage_uses_dated_saved_rate() {
  var fail=false;var service=Service(()=> fail?new(HttpStatusCode.ServiceUnavailable):new(HttpStatusCode.OK){Content=new StringContent(System.Text.Json.JsonSerializer.Serialize(new {date=DateTime.UtcNow.ToString("yyyy-MM-dd"),rates=new {PHP=57.25m}}))});
  var live=await service.Quote("CAD",10);Assert.False(live.IsFallback);Assert.Equal(572.50m,live.Converted);
  fail=true;var saved=await service.Quote("CAD",20);Assert.True(saved.IsFallback);Assert.Equal(live.RateDate,saved.RateDate);Assert.Equal(1145m,saved.Converted);
 }
 [Fact] public async Task No_cached_rate_returns_controlled_unavailable() {var service=Service(()=>new(HttpStatusCode.BadGateway));var ex=await Assert.ThrowsAsync<RuleException>(()=>service.Quote("JPY",100));Assert.Equal(503,ex.Status);}
 [Fact] public async Task Invalid_provider_response_never_becomes_a_quote() {var service=Service(()=>new(HttpStatusCode.OK){Content=new StringContent("{\"date\":\"1900-01-01\",\"rates\":{\"PHP\":0}}")});Assert.Equal(503,(await Assert.ThrowsAsync<RuleException>(()=>service.Quote("AUD",100))).Status);}
 [Theory] [InlineData("XYZ",100)] [InlineData("USD",-1)] public async Task Reject_invalid_input(string currency,decimal amount) {Assert.Equal(400,(await Assert.ThrowsAsync<RuleException>(()=>Service(()=>new(HttpStatusCode.OK)).Quote(currency,amount))).Status);}
}

