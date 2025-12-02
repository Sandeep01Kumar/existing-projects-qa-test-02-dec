package base;

import io.appium.java_client.android.AndroidDriver;
import org.apache.log4j.BasicConfigurator;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.testng.annotations.BeforeTest;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;

import static org.openqa.selenium.remote.CapabilityType.PLATFORM_NAME;

public class BaseTest {
    public AndroidDriver driver;

    @BeforeTest
    public void setUp() throws MalformedURLException {
        BasicConfigurator.configure();
        File appDir = new File("/Users/dhirajsharma/Drive/Desk/Personal/Projects/Random/FirstAppiumDemo/apps/");
        File app = new File(appDir, "test.apk");

        DesiredCapabilities capabilities = new DesiredCapabilities();
        capabilities.setCapability("automationName", "UiAutomator2");
        capabilities.setCapability("deviceName", "Android");
        capabilities.setCapability(PLATFORM_NAME, "Android");

        capabilities.setCapability("app", app.getAbsolutePath());
        driver = new AndroidDriver(new URL("http://127.0.0.1:4723/wd/hub"), capabilities);
    }

}
