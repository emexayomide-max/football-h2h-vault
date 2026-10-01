-- ============================================
-- Football H2H Vault Database Schema
-- ============================================

-- ============================================
-- TEAMS
-- ============================================

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    short_name VARCHAR(100),
    country VARCHAR(100),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- COMPETITIONS
-- ============================================

CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    country VARCHAR(100),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- SEASONS
-- ============================================

CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- MATCHES
-- ============================================

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,

    external_id INTEGER UNIQUE NOT NULL,

    competition_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,

    match_date TIMESTAMP NOT NULL,

    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,

    home_score INTEGER,
    away_score INTEGER,

    halftime_home_score INTEGER,
    halftime_away_score INTEGER,

    status VARCHAR(30) NOT NULL,

    venue VARCHAR(200),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_matches_competition
        FOREIGN KEY (competition_id)
        REFERENCES competitions(id),

    CONSTRAINT fk_matches_season
        FOREIGN KEY (season_id)
        REFERENCES seasons(id),

    CONSTRAINT fk_matches_home_team
        FOREIGN KEY (home_team_id)
        REFERENCES teams(id),

    CONSTRAINT fk_matches_away_team
        FOREIGN KEY (away_team_id)
        REFERENCES teams(id),

    CONSTRAINT different_home_away_teams
        CHECK (home_team_id <> away_team_id)
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_matches_home_team
    ON matches(home_team_id);

CREATE INDEX idx_matches_away_team
    ON matches(away_team_id);

CREATE INDEX idx_matches_competition
    ON matches(competition_id);

CREATE INDEX idx_matches_season
    ON matches(season_id);

CREATE INDEX idx_matches_date
    ON matches(match_date);

CREATE INDEX idx_matches_teams
    ON matches(home_team_id, away_team_id);
