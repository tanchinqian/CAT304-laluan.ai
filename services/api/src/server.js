require("./application")
  .start()
  .catch((error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`API port ${process.env.API_PORT || 4000} is already in use. Stop the earlier Laluan API before restarting.`);
    } else if (error.code === "EACCES") {
      console.error("The API cannot open its port. Check API_HOST, API_PORT and local network permissions.");
    } else {
      console.error("API startup failed. Check database access and Firebase configuration.");
    }
    process.exit(1);
  });
