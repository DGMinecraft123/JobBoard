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
INSERT INTO `contains` VALUES (1,1,1),(1,1,3),(1,1,5),(1,1,7),(1,1,48),(1,1,49),(1,2,9),(1,2,11),(1,2,13),(1,2,15),(1,2,17),(1,2,50),(1,2,53),(1,2,54),(2,1,2),(2,1,4),(2,1,6),(2,1,8),(3,2,10),(3,2,12),(3,2,14),(3,2,16),(3,2,18),(3,2,51),(3,2,52);
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
  PRIMARY KEY (`groupchat_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groupchat`
--

LOCK TABLES `groupchat` WRITE;
/*!40000 ALTER TABLE `groupchat` DISABLE KEYS */;
INSERT INTO `groupchat` VALUES (1,NULL),(2,NULL);
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
  PRIMARY KEY (`jobpost_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobpost`
--

LOCK TABLES `jobpost` WRITE;
/*!40000 ALTER TABLE `jobpost` DISABLE KEYS */;
INSERT INTO `jobpost` VALUES (1,'Cashier','San Francisco, CA','2025-06-26 17:15:49','Looking for an energetic cashier to join our grocery store team. Flexible hours and fast-paced environment.','jobpost/1','Friendly attitude, Basic math skills, Customer service','$17/hour'),(2,'Waiter','Oakland, CA','2025-06-26 17:15:49','Join our vibrant team at a family-style restaurant. Must be quick on your feet and polite to customers.','jobpost/2','Teamwork, Good memory, Communication skills','$20/hour with tips'),(3,'Food Runner','San Jose, CA','2025-06-26 17:15:49','Seeking a reliable food runner to support kitchen and wait staff. Great opportunity for growth.','jobpost/3','Time management, Physical stamina, Multi-tasking','$25/hour - 3 days per week max');
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
INSERT INTO `joins` VALUES (1,1),(1,2),(2,1),(3,2);
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
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,'Hi everyone! I\'m looking for software engineering opportunities in the Bay Area.','2025-06-27 10:00:00'),(2,'Welcome! I can help you with your job search. What\'s your experience level?','2025-06-27 10:05:00'),(3,'I have 3 years of experience with React and Node.js. Any tips?','2025-06-27 10:10:00'),(4,'That\'s great! I know a few companies hiring React developers right now.','2025-06-27 10:15:00'),(5,'Anyone interested in remote work opportunities?','2025-06-27 11:00:00'),(6,'Yes! I\'m looking for remote positions. What industries are you targeting?','2025-06-27 11:05:00'),(7,'I\'m interested in fintech and healthcare. Any leads?','2025-06-27 11:10:00'),(8,'I work at a fintech startup. We\'re hiring! DM me for details.','2025-06-27 11:15:00'),(9,'How do you handle technical interviews?','2025-06-27 12:00:00'),(10,'Practice on LeetCode and HackerRank. Also, mock interviews help a lot.','2025-06-27 12:05:00'),(11,'Thanks for the advice! Any specific topics I should focus on?','2025-06-27 12:10:00'),(12,'Focus on data structures, algorithms, and system design for senior roles.','2025-06-27 12:15:00'),(13,'Anyone here working on side projects?','2025-06-27 13:00:00'),(14,'I\'m building a job board app. Would love to collaborate!','2025-06-27 13:05:00'),(15,'That sounds interesting! What tech stack are you using?','2025-06-27 13:10:00'),(16,'React, Node.js, and MySQL. Looking for a designer to join.','2025-06-27 13:15:00'),(17,'I\'m a UI/UX designer! Let\'s connect.','2025-06-27 13:20:00'),(18,'Perfect! Let\'s schedule a call to discuss the project.','2025-06-27 13:25:00'),(48,'k','2025-06-26 18:18:45'),(49,'Hello','2025-06-26 18:50:09'),(50,'Ayyo','2025-06-26 18:50:19'),(51,'what\'s up man','2025-06-26 18:50:23'),(52,'you feel like doing something?','2025-06-26 18:50:44'),(53,'nothing much','2025-06-26 18:50:48'),(54,'??','2025-06-26 19:04:46');
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
INSERT INTO `posts` VALUES (1,1),(2,3),(3,2);
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
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Phuc','Thinh Nguyen','testing1@gmail.com','$2b$10$0w5BuU6dQyYqpuBSfJ6FW.aVEz.rR/18321T.0HtAsUWHkY3F//12','profile_picture/1'),(2,'Dinh','Nguyen Le','testing2@gmail.com','$2b$10$IGbcmzs8m5xXu1vaz6g8Z.1HTgrRoLBVoHhBXbit6oV7Nk29BBrMO','profile_picture/2'),(3,'Cong','Nam Anh Nguyen','testing3@gmail.com','$2b$10$VRJ12kjSxGsStTBzNuvxKe6GgmGq/Lpi1ysQxx9gCV5NBqJg3M4IW','profile_picture/3');
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

-- Dump completed on 2025-06-26 19:08:28
