using Microsoft.AspNetCore.Mvc;

namespace SurveyJsApp.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult AllSurveys()
    {
        return View();
    }

    public IActionResult TakeSurvey(int id)
    {
        ViewData["SurveyId"] = id;
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new { RequestId = HttpContext.TraceIdentifier });
    }
}