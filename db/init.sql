## MySQL
-- --------------------------------------------------------

--
-- Tabellstruktur `actionchoices`
--

CREATE TABLE `actionchoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `action_id` int(11) NOT NULL,
  `actionchoicetype_id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description_en` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sortorder` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `subactionchoices`
--

CREATE TABLE `subactionchoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `actionchoice_id` int(11) NOT NULL,
  `actionchoicetype_id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description_en` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sortorder` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `actionchoicetypes`
--

CREATE TABLE `actionchoicetypes` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `kthschools`
--

CREATE TABLE `kthschools` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `actions`
--

CREATE TABLE `actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `event_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `name_en` varchar(50) NOT NULL,
  `description` varchar(200) NOT NULL,
  `description_en` varchar(200) NOT NULL,
  `image_id` varchar(50) NOT NULL,
  `rgbacolor` varchar(25) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Tabellstruktur `confirmationsynonyms`
--

CREATE TABLE `confirmationsynonyms` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `event_id` int(11) NOT NULL,
  `synonym` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(50) NOT NULL,
  `name_en` varchar(50) NOT NULL,
  `description` varchar(200) NOT NULL,
  `description_en` varchar(200) NOT NULL,
  `startdate` date NOT NULL,
  `enddate` date NOT NULL,
  `resultstitle` varchar(50) NOT NULL,
  `resultstitle_en` varchar(50) NOT NULL,
  `resultssubtitle` varchar(200) NOT NULL,
  `resultssubtitle_en` varchar(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Tabellstruktur `images`
--

CREATE TABLE `images` (
  `id` int(6) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `fullpath` varchar(300) DEFAULT NULL,
  `name` char(50) DEFAULT NULL,
  `size` char(50) DEFAULT NULL,
  `type` char(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Tabellstruktur `useractionchoices`
--

CREATE TABLE `useractionchoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `actionchoice_id` int(11) NOT NULL,
  `uuid` varchar(36) NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Tabellstruktur `usersubactionchoices`
--

CREATE TABLE `usersubactionchoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `subactionchoice_id` int(11) NOT NULL,
  `uuid` varchar(36) NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Tabellstruktur `useractiondata`
--

CREATE TABLE `useractiondata` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `usertype_code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schoolcode` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uuid` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `usertextmessages`
--

CREATE TABLE `useractionmessages` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uuid` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subactionchoice_id` int(11) NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `usertypes`
--

CREATE TABLE `usertypes` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description_en` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

