const express = require("express");
const pool = require("../db");

const {
  getSeasonEvents,
} = require("../services/theSportsDb");

const router = express.Router();


/*
==========================================
IMPORT FIXTURES FROM THESPORTSDB
==========================================

POST

/api/fixtures/import/:leagueId?season=2025-2026

Example:

curl -X POST \
"http://localhost:3001/api/fixtures/import/4328?season=2025-2026"

*/


router.post(
  "/import/:leagueId",
  async (req, res) => {

    const {
      leagueId,
    } = req.params;


    const {
      season,
    } = req.query;



    if (!season) {

      return res.status(400).json({
        status:"error",
        message:
        "season is required"
      });

    }



    try {


      /*
      Get events from TheSportsDB
      */

      const data =
        await getSeasonEvents(
          leagueId,
          season
        );


      if (
        !data.events ||
        data.events.length === 0
      ) {

        return res.json({

          status:"success",

          message:
          "No events found",

          imported:0

        });

      }



      let imported = 0;



      for(
        const event of data.events
      ){


        /*
        Find teams
        */


        const homeTeam =
        await pool.query(
          `
          SELECT id
          FROM teams
          WHERE name=$1
          `,
          [
            event.strHomeTeam
          ]
        );


        const awayTeam =
        await pool.query(
          `
          SELECT id
          FROM teams
          WHERE name=$1
          `,
          [
            event.strAwayTeam
          ]
        );



        /*
        Skip matches where teams
        are not imported yet
        */

        if(
          homeTeam.rows.length===0 ||
          awayTeam.rows.length===0
        ){

          continue;

        }



        /*
        Create competition
        */

        let competition =
        await pool.query(
          `
          SELECT id
          FROM competitions
          WHERE name=$1
          `,
          [
            event.strLeague
          ]
        );



        let competitionId;



        if(
          competition.rows.length===0
        ){


          const inserted =
          await pool.query(
            `
            INSERT INTO competitions
            (
              external_id,
              name,
              country
            )

            VALUES
            (
              $1,$2,$3
            )

            RETURNING id
            `,
            [
              leagueId,
              event.strLeague,
              event.strCountry
            ]
          );


          competitionId =
          inserted.rows[0].id;


        }
        else{

          competitionId =
          competition.rows[0].id;

        }




        /*
        Create season
        */

        let seasonResult =
        await pool.query(
          `
          SELECT id
          FROM seasons
          WHERE name=$1
          `,
          [
            season
          ]
        );


        let seasonId;



        if(
          seasonResult.rows.length===0
        ){


          const inserted =
          await pool.query(
            `
            INSERT INTO seasons
            (
              external_id,
              name,
              start_year,
              end_year
            )

            VALUES
            (
              $1,$2,$3,$4
            )

            RETURNING id
            `,
            [
              Number(season.split("-")[0]),
              season,
              Number(season.split("-")[0]),
              Number(season.split("-")[1])
            ]
          );


          seasonId =
          inserted.rows[0].id;


        }
        else{


          seasonId =
          seasonResult.rows[0].id;


        }




        /*
        Insert match
        */


        await pool.query(
          `
          INSERT INTO matches

          (
            external_id,
            competition_id,
            season_id,

            match_date,

            home_team_id,
            away_team_id,

            home_score,
            away_score,

            status,

            venue

          )


          VALUES

          (
            $1,$2,$3,
            $4,
            $5,$6,
            $7,$8,
            $9,$10
          )


          ON CONFLICT
          (external_id)
          DO NOTHING

          `,
          [

            Number(event.idEvent),

            competitionId,

            seasonId,


            event.dateEvent +
            " " +
            (event.strTime || "00:00"),


            homeTeam.rows[0].id,

            awayTeam.rows[0].id,


            event.intHomeScore,

            event.intAwayScore,


            event.strStatus === "Match Finished"
              ?
              "finished"
              :
              "scheduled",


            event.strVenue

          ]
        );


        imported++;


      }




      res.json({

        status:"success",

        imported

      });



    }
    catch(error){


      console.error(
        "Fixture import failed:",
        error.message
      );


      res.status(500).json({

        status:"error",

        message:
        "Failed to import fixtures"

      });


    }


  }
);



module.exports = router;