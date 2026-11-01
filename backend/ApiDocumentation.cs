using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
namespace StockFlow;

public class ApiDocumentation : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var roles = context.ApiDescription.ActionDescriptor.EndpointMetadata.OfType<IAuthorizeData>().Select(x => x.Roles).Where(x => x != null);
        operation.Description = "Authentication uses an HttpOnly session cookie. First call /api/auth/login here. " + string.Join(" ", roles.Select(x => "Allowed roles: " + x + "."));
        operation.Responses ??= new OpenApiResponses();
        operation.Responses.TryAdd("400", new OpenApiResponse { Description = "Invalid input; validation ProblemDetails or a plain-language detail." });
        operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Sign in required or account session ended." });
        operation.Responses.TryAdd("403", new OpenApiResponse { Description = "Role does not allow this operation." });
        operation.Responses.TryAdd("409", new OpenApiResponse { Description = "State, stock, duplicate or relationship conflict. Refresh and retry." });
        if (context.ApiDescription.RelativePath == "api/currency") operation.Responses.TryAdd("503", new OpenApiResponse { Description = "Provider unavailable; no usable saved rate. Inventory and orders are unaffected." });
        if (context.ApiDescription.HttpMethod is "POST" or "PUT" or "DELETE")
        {
            operation.Parameters ??= []; operation.Parameters.Add(new OpenApiParameter { Name = "X-StockFlow", In = ParameterLocation.Header, Required = true, Description = "CSRF protection; use 1.", Schema = new OpenApiSchema { Type = JsonSchemaType.String, Default = System.Text.Json.Nodes.JsonValue.Create("1") } });
            var path = context.ApiDescription.RelativePath ?? ""; var method = context.ApiDescription.HttpMethod;
            var created = method == "POST" && new[] { "api/products", "api/orders", "api/categories", "api/suppliers", "api/customers", "api/users" }.Contains(path);
            var code = created ? "201" : path == "api/auth/login" ? "200" : "204";
            if (code != "200") operation.Responses.Remove("200"); operation.Responses.TryAdd(code, new OpenApiResponse { Description = created ? "Record created." : "Success." });
        }
    }
}
