(function () {
  "use strict";

  function twoDigits(value) {
    return String(value).padStart(2, "0");
  }

  function buildCalendar(root) {
    var year = Number(root.getAttribute("data-year"));
    var month = Number(root.getAttribute("data-month"));
    var grid = root.querySelector("[data-calendar-grid]");
    var data = root.querySelector("[data-calendar-posts]");

    if (!year || !month || !grid || !data) return;

    var posts;
    try {
      posts = JSON.parse(data.textContent);
    } catch (error) {
      return;
    }

    var postsByDate = posts.reduce(function (result, post) {
      if (!result[post.date]) result[post.date] = [];
      result[post.date].push(post);
      return result;
    }, {});

    var firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var today = new Date();
    var todayKey = [today.getFullYear(), twoDigits(today.getMonth() + 1), twoDigits(today.getDate())].join("-");

    for (var blank = 0; blank < firstWeekday; blank += 1) {
      var spacer = document.createElement("span");
      spacer.className = "home-calendar__day is-empty";
      spacer.setAttribute("aria-hidden", "true");
      grid.appendChild(spacer);
    }

    for (var day = 1; day <= lastDay; day += 1) {
      var key = [year, twoDigits(month), twoDigits(day)].join("-");
      var dayPosts = postsByDate[key] || [];
      var cell = document.createElement(dayPosts.length ? "a" : "span");
      cell.className = "home-calendar__day";
      cell.textContent = day;

      if (dayPosts.length) {
        cell.classList.add("has-post");
        cell.href = dayPosts[0].url;
        cell.title = dayPosts.map(function (post) { return post.title; }).join("\n");
        cell.setAttribute("aria-label", month + "월 " + day + "일, 글 " + dayPosts.length + "편");
      }

      if (key === todayKey) {
        cell.classList.add("is-today");
        cell.setAttribute("aria-current", "date");
      }

      grid.appendChild(cell);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-home-calendar]").forEach(buildCalendar);
  });
})();
