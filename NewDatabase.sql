-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: linkedout
-- ------------------------------------------------------
-- Server version	8.0.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `applies`
--

DROP TABLE IF EXISTS `applies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applies` (
  `user_id` int NOT NULL,
  `jobpost_id` int NOT NULL,
  `applied_date` text,
  PRIMARY KEY (`user_id`,`jobpost_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `applies`
--

LOCK TABLES `applies` WRITE;
/*!40000 ALTER TABLE `applies` DISABLE KEYS */;
INSERT INTO `applies` VALUES (1,3,'2025-06-28 11:56:14'),(1,6,'2025-06-28T01:02:13.532Z');
/*!40000 ALTER TABLE `applies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contains`
--

DROP TABLE IF EXISTS `contains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contains` (
  `user_id` int NOT NULL,
  `groupchat_id` int NOT NULL,
  `message_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`groupchat_id`,`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contains`
--

LOCK TABLES `contains` WRITE;
/*!40000 ALTER TABLE `contains` DISABLE KEYS */;
INSERT INTO `contains` VALUES (1,1,2),(1,1,4),(1,1,5),(1,1,6),(1,1,7),(1,1,9),(1,1,10),(1,1,20),(1,2,1),(1,2,3),(1,2,8),(1,2,11),(1,2,18),(2,1,70),(2,1,73),(2,3,29),(2,3,41),(2,3,43),(2,3,45),(2,3,46),(2,3,58),(2,3,63),(2,3,64),(2,3,66),(2,3,69),(2,3,71),(2,3,72),(2,3,76),(3,2,12),(3,2,13),(3,2,14),(3,2,15),(3,2,16),(3,2,17),(3,2,19),(13,3,21),(13,3,22),(13,3,23),(13,3,24),(13,3,25),(13,3,26),(13,3,27),(13,3,28),(13,3,30),(13,3,31),(13,3,32),(13,3,33),(13,3,34),(13,3,35),(13,3,36),(13,3,37),(13,3,38),(13,3,39),(13,3,40),(13,3,42),(13,3,44),(13,3,47),(13,3,48),(13,3,49),(13,3,50),(13,3,51),(13,3,52),(13,3,53),(13,3,54),(13,3,55),(13,3,56),(13,3,57),(13,3,59),(13,3,60),(13,3,61),(13,3,62),(13,3,65),(13,3,67),(13,3,68),(13,3,74),(13,3,75);
/*!40000 ALTER TABLE `contains` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groupchat`
--

DROP TABLE IF EXISTS `groupchat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groupchat` (
  `groupchat_id` int NOT NULL AUTO_INCREMENT,
  `groupchat_name` text,
  `groupchat_status` int DEFAULT NULL,
  PRIMARY KEY (`groupchat_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groupchat`
--

LOCK TABLES `groupchat` WRITE;
/*!40000 ALTER TABLE `groupchat` DISABLE KEYS */;
INSERT INTO `groupchat` VALUES (1,'Pending chat between Phuc Thinh Nguyen and Dinh Nguyen Le',1),(2,'Pending chat between Phuc Thinh Nguyen and Cong Nam Anh Nguyen',1),(3,'Chat between user 13 and 2',1);
/*!40000 ALTER TABLE `groupchat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobpost`
--

DROP TABLE IF EXISTS `jobpost`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobpost` (
  `jobpost_id` int NOT NULL AUTO_INCREMENT,
  `title` text,
  `location` text,
  `date` datetime DEFAULT NULL,
  `description` text,
  `pictures_url` text,
  `qualifications` text,
  `salary` text,
  `name` text,
  PRIMARY KEY (`jobpost_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobpost`
--

LOCK TABLES `jobpost` WRITE;
/*!40000 ALTER TABLE `jobpost` DISABLE KEYS */;
INSERT INTO `jobpost` VALUES (1,'Cashier','919 Kearny St, San Francisco, CA 94133','2025-06-26 17:15:49','Looking for an energetic cashier to join our grocery store team. Flexible hours and fast-paced environment.','jobpost/1','Friendly attitude, Basic math skills, Customer service','$17/hour','House of Nanking'),(2,'Waiter','4171 MacArthur Blvd, Oakland, CA 94619','2025-06-26 17:15:49','Join our vibrant team at a family-style restaurant. Must be quick on your feet and polite to customers.','jobpost/2','Teamwork, Good memory, Communication skills','$20/hour with tips','Golondrinas Mexican Grill'),(3,'Food Runner','1631 E Capitol Expy Ste #107, San Jose, CA 95121','2025-06-26 17:15:49','Seeking a reliable food runner to support kitchen and wait staff. Great opportunity for growth.','jobpost/3','Time management, Physical stamina, Multi-tasking','$25/hour - 3 days per week max','Thien Huong Sandwiches & Bakery'),(4,'Babysitter','123 Main St, San Jose, CA 95112','2025-06-27 17:05:32','Looking for a caring babysitter for 2 kids. Flexible evening hours.','jobpost/4','Patience, First aid knowledge, Good communication','$18/hour','Home'),(5,'Dishwasher','Sushi Confidential, 31 N Market St, San Jose, CA 95113‑1207','2025-06-27 16:55:32','Help keep our kitchen running smoothly. No experience required.','jobpost/5','Reliability, Physical stamina, Attention to detail','$16/hour','Sushi Confidential'),(6,'Barista','Philz Coffee, 748 Van Ness Ave, San Francisco, CA 94102','2025-06-27 17:10:32','Join our team to craft delicious coffee drinks and provide excellent service.','jobpost/6','Customer service, Multitasking, Friendly attitude','$19/hour + tips','Philz Coffee'),(7,'Host','La Mediterranee, 288 Noe St, San Francisco, CA 94114','2025-06-27 16:45:32','We need a friendly host to greet and seat guests. Part-time available.','jobpost/7','Organization, Communication skills, Positivity','$17/hour','La Mediterranee'),(8,'Cleaner','567 Maple St, Oakland, CA 94607','2025-06-27 17:00:32','Seeking a cleaner for private residence. Flexible schedule.','jobpost/8','Efficiency, Trustworthy, Attention to detail','$20/hour','Home'),(9,'Prep Cook','Trueburger, 146 Grand Ave, Oakland, CA 94612','2025-06-27 16:35:32','Assist our kitchen team with food prep. Great learning opportunity.','jobpost/9','Knife skills, Teamwork, Reliability','$18/hour','Trueburger');
/*!40000 ALTER TABLE `jobpost` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `joins`
--

DROP TABLE IF EXISTS `joins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `joins` (
  `user_id` int NOT NULL,
  `groupchat_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`groupchat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `joins`
--

LOCK TABLES `joins` WRITE;
/*!40000 ALTER TABLE `joins` DISABLE KEYS */;
INSERT INTO `joins` VALUES (1,1),(1,2),(2,1),(2,3),(3,2),(13,3);
/*!40000 ALTER TABLE `joins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `message_content` text,
  `message_time` datetime DEFAULT NULL,
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,'hey there man','2025-06-27 19:47:16'),(2,'I am interested in job opportunities.','2025-06-27 19:55:34'),(3,'hmm','2025-06-27 20:03:47'),(4,'hey there','2025-06-28 01:16:00'),(5,'lmao','2025-06-28 01:18:34'),(6,'okay man','2025-06-28 01:21:18'),(7,'alrighty!','2025-06-28 01:21:22'),(8,'let\'s see how it goes','2025-06-28 01:21:27'),(9,'okkk','2025-06-28 01:42:15'),(10,'heyu','2025-06-28 01:46:18'),(11,'hmmmgddg','2025-06-28 01:46:24'),(12,'e may','2025-06-28 01:46:49'),(13,'what\'s up man','2025-06-28 01:47:11'),(14,'???','2025-06-28 01:47:59'),(15,'dawg you know it','2025-06-28 01:48:07'),(16,'hey i was just wondering','2025-06-28 01:50:49'),(17,'yo gfgfgf','2025-06-28 01:50:53'),(18,'what\'s up mannn','2025-06-28 01:51:01'),(19,'kay','2025-06-28 01:51:17'),(20,'okkk','2025-06-28 11:55:12'),(21,'hello there','2025-06-28 15:45:07'),(22,'what\'s up man','2025-06-28 16:09:28'),(23,'hey man that\'s illegal','2025-06-28 16:25:00'),(24,'what\'s up man','2025-06-28 16:27:38'),(25,'=== Translation Request ===\r\nInput: Translate the following text to spanish: \"hmm\"\r\n\r\n\r\n�Hmm!','2025-06-28 16:33:11'),(26,'=== Translation Request ===\r\nInput: Translate the following text to spanish: \"what\'s up man\"\r\n\r\n\r\n�Hola, amigo!\r\n\r\n(Note: The translation can vary depending','2025-06-28 16:34:00'),(27,'=== Translation Request ===\r\nInput: Translate the following text to spanish: \"yo wtf\"\r\n\r\n\r\n\"�Yo WTF!\"\r\n\r\nIn Spanish, \"WTF\" is','2025-06-28 16:34:07'),(28,'what the hell was that','2025-06-28 16:35:28'),(29,'idk','2025-06-28 16:42:33'),(30,'lmaoo','2025-06-28 16:42:44'),(31,'i can see that','2025-06-28 16:42:51'),(32,'okay what\'s up','2025-06-28 17:34:32'),(33,'\'okay man\'','2025-06-28 17:39:40'),(34,'\'let me see\'','2025-06-28 17:42:34'),(35,'\'Hello man, how are you doing?\'','2025-06-28 17:44:51'),(36,'\'hey there\' in English is: \'hello there\'.','2025-06-28 17:46:11'),(37,'\'lmao\'','2025-06-28 17:47:11'),(38,'\'wait what\'','2025-06-28 17:49:11'),(39,'\'im just asking you\'','2025-06-28 17:50:14'),(40,'\'What did you do?\'','2025-06-28 17:51:30'),(41,'\"idk man\" translates to \"Je sais pas, mec\" in French.','2025-06-28 17:51:37'),(42,'what\'s going on','2025-06-28 17:54:40'),(43,'no clue','2025-06-28 17:54:45'),(44,'okay then imma just go take a shower','2025-06-28 17:55:17'),(45,'sure no problem','2025-06-28 17:56:03'),(46,'je suis Scott','2025-06-28 17:57:22'),(47,'hello man','2025-06-28 18:04:48'),(48,'] Hello there!','2025-06-28 18:06:00'),(49,'air 2 with a cracked screen\n\nTranslation: How much does it cost to repair an iPad Air 2 with a shattered display?','2025-06-28 18:06:30'),(50,', it\'s not even funny.\n\n\"So random, it\'s not even funny.','2025-06-28 18:08:15'),(51,'let me see how it goes','2025-06-28 18:09:37'),(52,'let me see','2025-06-28 18:10:38'),(53,'what','2025-06-28 18:12:15'),(54,'hey how are you doing','2025-06-28 18:13:29'),(55,'hmmgdgd okay','2025-06-28 18:15:14'),(56,'alright\\','2025-06-28 18:16:58'),(57,'Alright, how\'s it going?','2025-06-28 18:17:46'),(58,'Je vais bien, mec.','2025-06-28 18:18:01'),(59,'Okay. If an issue arose, how would you handle it and address the problem?','2025-06-28 18:18:22'),(60,'How about heading to a location where we can savor some cuisine?','2025-06-28 18:18:44'),(61,'what about some food?','2025-06-29 00:02:11'),(62,'i dont wanna really know what to eat man','2025-06-29 00:03:41'),(63,'lowkey:)))','2025-06-29 00:03:54'),(64,'j\'ai l\'impression que ce sera soit un hamburger, soit un steak','2025-06-29 00:04:45'),(65,'what steak do you want to eat','2025-06-29 00:07:22'),(66,'peut-être le steak au restaurant Grandview','2025-06-29 00:09:12'),(67,'sure let\'s do it','2025-06-29 00:09:29'),(68,'alright there we go!','2025-06-29 00:11:59'),(69,'Bien sûr, faisons-le mec','2025-06-29 00:23:09'),(70,'c\'est quoi ce bordel?','2025-06-29 00:30:46'),(71,'c\'est quoi ce bordel?','2025-06-29 00:34:59'),(72,'oh mon dieu c\'est trop lent','2025-06-29 00:35:38'),(73,'oh mon dieu c\'est trop lent','2025-06-29 00:35:42'),(74,'haha i could def figure','2025-06-29 00:36:19'),(75,'imma go to sleep tonight okay?','2025-06-29 00:56:32'),(76,'uncun probleme','2025-06-29 00:57:19');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `user_id` int NOT NULL,
  `jobpost_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`jobpost_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
INSERT INTO `posts` VALUES (1,1),(1,4),(1,5),(2,3),(2,6),(2,7),(3,2),(3,8),(3,9);
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` text,
  `last_name` text,
  `email` text,
  `password` text,
  `profile_picture_url` text,
  `preferred_language` text,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Phuc','Thinh Nguyen','testing1@gmail.com','$2b$10$0w5BuU6dQyYqpuBSfJ6FW.aVEz.rR/18321T.0HtAsUWHkY3F//12','profile_picture/1',NULL),(2,'Dinh','Nguyen Le','testing2@gmail.com','$2b$10$IGbcmzs8m5xXu1vaz6g8Z.1HTgrRoLBVoHhBXbit6oV7Nk29BBrMO','profile_picture/2','french'),(3,'Cong','Nam Anh Nguyen','testing3@gmail.com','$2b$10$VRJ12kjSxGsStTBzNuvxKe6GgmGq/Lpi1ysQxx9gCV5NBqJg3M4IW','profile_picture/3',NULL),(12,'Odin','Bruyere','testing4@gmail.com','$2b$10$ErHfoPyO9GIH0j8uMT3xyesIIltuIlaJikioKU8UPNyWAsfv3vCay',NULL,NULL),(13,'Nick','Zorzi','testing5@gmail.com','$2b$10$vainyp0PHhgECfxfxQZI7O52f5gc4h/5IfmKpxiyjo8TzmZdOlQwO','profile_picture/13',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-29  1:04:24
