using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StockFlow;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<StockDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? "Host=localhost;Port=55432;Database=stockflow;Username=stockflow"));
builder.Services.AddIdentity<Employee, IdentityRole>(o => { o.Password.RequiredLength = 12; o.User.RequireUniqueEmail = true; o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10); }).AddEntityFrameworkStores<StockDb>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "StockFlow.Session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromHours(4); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = async ctx =>
    {
        var manager = ctx.HttpContext.RequestServices.GetRequiredService<UserManager<Employee>>(); var u = await manager.GetUserAsync(ctx.Principal!);
        if (u is null || !u.Active || ctx.Principal!.FindFirstValue("AspNet.Identity.SecurityStamp") != await manager.GetSecurityStampAsync(u)) ctx.RejectPrincipal();
    };
});
builder.Services.AddAuthorization(); builder.Services.AddControllers(); builder.Services.AddEndpointsApiExplorer(); builder.Services.AddSwaggerGen(o => o.OperationFilter<ApiDocumentation>());
builder.Services.AddScoped<OrderService>(); builder.Services.AddHttpClient<CurrencyService>(c => { c.BaseAddress = new Uri("https://api.frankfurter.dev/v1/"); c.Timeout = TimeSpan.FromSeconds(5); });
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })); });
var app = builder.Build();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "same-origin";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    try
    {
        // A custom header cannot be submitted by a cross-site form. No cross-origin CORS is enabled.
        if (ctx.Request.Path.StartsWithSegments("/api") && new[] { "POST", "PUT", "DELETE", "PATCH" }.Contains(ctx.Request.Method) && ctx.Request.Headers["X-StockFlow"] != "1") throw new RuleException(400, "Please use StockFlow to submit this request, or add the X-StockFlow: 1 API header.");
        await next();
    }
    catch (Exception e)
    {
        var status = e switch { RuleException r => r.Status, DbUpdateException => 409, Npgsql.PostgresException p when p.SqlState is "40001" or "40P01" => 409, BadHttpRequestException => 400, _ => 500 };
        if (status == 500) app.Logger.LogError(e, "Request failed. Trace {TraceId}", ctx.TraceIdentifier);
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new { title = status == 500 ? "We could not complete that request." : "Please check your request", status, detail = e is RuleException ? e.Message : status == 409 ? "This record changed or conflicts with an existing record. Refresh and try again." : status == 400 ? "Check the information you entered." : "Please try again. If this continues, contact your administrator.", traceId = ctx.TraceIdentifier });
    }
});
app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers(); app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
if (!args.Contains("--no-seed")) { using var scope = app.Services.CreateScope(); await Seeder.Run(scope.ServiceProvider, app.Configuration); }
app.Run();
public partial class Program { }

